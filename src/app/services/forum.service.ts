import { Injectable } from '@angular/core';
import { AuthService, User } from './auth.service';
import { getFirestoreInstance, initFirebaseIfNeeded, isFirebaseEnabled, uploadFileToStorage } from './firebase.init';

export type ForumCategory = 'help' | 'showcase' | 'trade' | 'general';
export type ForumSort = 'newest' | 'most-commented';

export interface ForumPost {
  id: string;
  authorEmail: string;
  authorName: string;
  authorPhotoURL: string;
  title: string;
  body: string;
  category: ForumCategory;
  imageUrls: string[];
  createdAt: number;
  updatedAt: number;
  commentCount: number;
  hidden: boolean;
}

export interface ForumComment {
  id: string;
  postId: string;
  authorEmail: string;
  authorName: string;
  authorPhotoURL: string;
  body: string;
  createdAt: number;
  hidden: boolean;
}

@Injectable({ providedIn: 'root' })
export class ForumService {
  private readonly forumPostsCollectionName = 'forum_posts';
  private readonly forumCommentsCollectionName = 'forum_comments';
  private readonly maxUploadBytes = 12 * 1024 * 1024;
  private readonly preferredUploadBytes = 2.5 * 1024 * 1024;
  private readonly uploadTimeoutMs = 15000;
  private readonly inlineFallbackMaxBytes = 120 * 1024;
  private readonly inlineFallbackMaxTotalChars = 700 * 1024;
  private readonly replySeenStorageKeyPrefix = 'ob_forum_reply_seen_v1';
  private readonly blockedWords = [
    'fuck',
    'fucking',
    'shit',
    'bitch',
    'asshole',
    'cunt',
    'nigger',
    'nigga',
    'fag',
    'retard',
    'whore',
    'slut',
    'motherfucker',
    'dick',
    'cock',
    'pussy',
  ];

  constructor(private authService: AuthService) {}

  getCurrentUser(): User | null {
    return this.authService.getCurrent();
  }

  isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  getReplySeenState(): Record<string, number> {
    const current = this.authService.getCurrent();
    const email = String(current?.email || '').trim().toLowerCase();
    if (!email) return {};
    const raw = localStorage.getItem(`${this.replySeenStorageKeyPrefix}:${email}`);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return {};
      return Object.entries(parsed).reduce((acc, [postId, seenAt]) => {
        const normalizedPostId = String(postId || '').trim();
        const numericSeenAt = Number(seenAt);
        if (normalizedPostId && Number.isFinite(numericSeenAt)) {
          acc[normalizedPostId] = numericSeenAt;
        }
        return acc;
      }, {} as Record<string, number>);
    } catch {
      return {};
    }
  }

  markPostRepliesSeen(postId: string, at: number = Date.now()): void {
    const current = this.authService.getCurrent();
    const email = String(current?.email || '').trim().toLowerCase();
    const normalizedPostId = String(postId || '').trim();
    if (!email || !normalizedPostId) return;
    const nextState = {
      ...this.getReplySeenState(),
      [normalizedPostId]: at,
    };
    localStorage.setItem(`${this.replySeenStorageKeyPrefix}:${email}`, JSON.stringify(nextState));
  }

  hasUnreadRepliesForPost(postId: string, comments: ForumComment[], seenState: Record<string, number>): boolean {
    const current = this.authService.getCurrent();
    const email = String(current?.email || '').trim().toLowerCase();
    const normalizedPostId = String(postId || '').trim();
    if (!email || !normalizedPostId) return false;
    const seenAt = Number(seenState?.[normalizedPostId] || 0);
    return comments.some((comment) =>
      String(comment.postId || '').trim() === normalizedPostId
      && String(comment.authorEmail || '').trim().toLowerCase() !== email
      && Number(comment.createdAt || 0) > seenAt,
    );
  }

  async subscribeUnreadReplyCount(
    onCount: (count: number) => void,
    onError?: (error: any) => void,
  ): Promise<() => void> {
    const current = this.authService.getCurrent();
    const email = String(current?.email || '').trim().toLowerCase();
    if (!email || !isFirebaseEnabled()) {
      onCount(0);
      return () => {};
    }

    await initFirebaseIfNeeded();
    const firestore = getFirestoreInstance();
    if (!firestore) {
      onCount(0);
      return () => {};
    }

    const seenState = this.getReplySeenState();
    const { collection, onSnapshot } = await import('firebase/firestore');
    const postsRef = collection(firestore, this.forumPostsCollectionName);
    const commentsRef = collection(firestore, this.forumCommentsCollectionName);

    let latestPosts: ForumPost[] = [];
    let latestComments: ForumComment[] = [];

    const emit = () => {
      const ownedPostIds = new Set(
        latestPosts
          .filter((post) => String(post.authorEmail || '').trim().toLowerCase() === email)
          .map((post) => post.id),
      );
      if (ownedPostIds.size === 0) {
        onCount(0);
        return;
      }
      const unreadPostIds = new Set(
        latestComments
          .filter((comment) =>
            ownedPostIds.has(String(comment.postId || '').trim())
            && String(comment.authorEmail || '').trim().toLowerCase() !== email
            && Number(comment.createdAt || 0) > Number(seenState[String(comment.postId || '').trim()] || 0),
          )
          .map((comment) => String(comment.postId || '').trim()),
      );
      onCount(unreadPostIds.size);
    };

    const unsubscribePosts = onSnapshot(
      postsRef,
      (snap: any) => {
        latestPosts = (snap.docs || [])
          .map((docSnap: any) => this.normalizePost(docSnap.id, docSnap.data?.() || {}))
          .filter((post: ForumPost) => !post.hidden);
        emit();
      },
      (error: any) => {
        console.warn('Unread forum post subscription failed', error);
        if (onError) onError(error);
      },
    );

    const unsubscribeComments = onSnapshot(
      commentsRef,
      (snap: any) => {
        latestComments = (snap.docs || [])
          .map((docSnap: any) => this.normalizeComment(docSnap.id, docSnap.data?.() || {}))
          .filter((comment: ForumComment) => !comment.hidden);
        emit();
      },
      (error: any) => {
        console.warn('Unread forum comment subscription failed', error);
        if (onError) onError(error);
      },
    );

    return () => {
      unsubscribePosts();
      unsubscribeComments();
    };
  }

  async createPost(input: {
    title: string;
    body: string;
    category: ForumCategory;
    files?: File[];
  }): Promise<void> {
    const current = this.requireCurrentUser();
    const title = String(input.title || '').trim();
    const body = String(input.body || '').trim();
    const category = this.normalizeCategory(input.category);
    const files = Array.isArray(input.files) ? input.files.slice(0, 4) : [];

    if (!title) throw new Error('Post title is required.');
    if (title.length > 80) throw new Error('Post title must be 80 characters or less.');
    if (!body) throw new Error('Post text is required.');
    if (body.length > 1200) throw new Error('Post text must be 1200 characters or less.');
    this.assertAllowedText(title, 'Title');
    this.assertAllowedText(body, 'Post');
    this.assertAllowedFiles(files);

    if (!isFirebaseEnabled()) {
      throw new Error('Forum is unavailable until Firebase is enabled.');
    }

    await initFirebaseIfNeeded();
    const firestore = getFirestoreInstance();
    if (!firestore) throw new Error('Forum database is not initialized.');

    const now = Date.now();
    const imageUrls: string[] = [];
    let inlineFallbackTotalChars = 0;
    for (let i = 0; i < files.length; i += 1) {
      const file = await this.prepareImageForUpload(files[i]);
      if (file.size > this.maxUploadBytes) {
        throw new Error('One of the selected images is still too large after compression. Please choose a smaller image.');
      }
      const safeName = String(file.name || 'upload')
        .replace(/[^a-z0-9._-]/gi, '_')
        .slice(-80);
      const url = await this.uploadPostImage(
        file,
        `forum_posts/${encodeURIComponent(current.email)}/${now}_${i}_${safeName}`,
      );
      if (url.startsWith('data:')) {
        inlineFallbackTotalChars += url.length;
        if (inlineFallbackTotalChars > this.inlineFallbackMaxTotalChars) {
          throw new Error('The selected images are too large to attach right now. Please use fewer images or smaller files.');
        }
      }
      imageUrls.push(String(url || '').trim());
    }

    const { addDoc, collection } = await import('firebase/firestore');
    await addDoc(collection(firestore, this.forumPostsCollectionName), {
      authorEmail: String(current.email || '').trim().toLowerCase(),
      authorName: this.getUserDisplayName(current),
      authorPhotoURL: String(current.photoURL || '').trim(),
      title,
      body,
      category,
      imageUrls,
      createdAt: now,
      updatedAt: now,
      commentCount: 0,
      hidden: false,
    });
  }

  async addComment(postId: string, body: string): Promise<void> {
    const current = this.requireCurrentUser();
    const normalizedPostId = String(postId || '').trim();
    const content = String(body || '').trim();

    if (!normalizedPostId) throw new Error('Missing post id.');
    if (!content) throw new Error('Comment text is required.');
    if (content.length > 400) throw new Error('Comment must be 400 characters or less.');
    this.assertAllowedText(content, 'Comment');

    if (!isFirebaseEnabled()) {
      throw new Error('Forum is unavailable until Firebase is enabled.');
    }

    await initFirebaseIfNeeded();
    const firestore = getFirestoreInstance();
    if (!firestore) throw new Error('Forum database is not initialized.');

    const { addDoc, collection, doc, increment, updateDoc } = await import('firebase/firestore');
    await addDoc(collection(firestore, this.forumCommentsCollectionName), {
      postId: normalizedPostId,
      authorEmail: String(current.email || '').trim().toLowerCase(),
      authorName: this.getUserDisplayName(current),
      authorPhotoURL: String(current.photoURL || '').trim(),
      body: content,
      createdAt: Date.now(),
      hidden: false,
    });
    await updateDoc(doc(firestore, this.forumPostsCollectionName, normalizedPostId), {
      commentCount: increment(1),
      updatedAt: Date.now(),
    });
  }

  async subscribePosts(
    onData: (posts: ForumPost[]) => void,
    onError?: (error: any) => void,
  ): Promise<() => void> {
    if (!isFirebaseEnabled()) {
      onData([]);
      return () => {};
    }

    await initFirebaseIfNeeded();
    const firestore = getFirestoreInstance();
    if (!firestore) {
      onData([]);
      return () => {};
    }

    const { collection, onSnapshot } = await import('firebase/firestore');
    const ref = collection(firestore, this.forumPostsCollectionName);
    const unsubscribe = onSnapshot(
      ref,
      (snap: any) => {
        const posts = (snap.docs || [])
          .map((docSnap: any) => this.normalizePost(docSnap.id, docSnap.data?.() || {}))
          .filter((post: ForumPost) => !post.hidden);
        onData(posts);
      },
      (error: any) => {
        console.warn('Forum posts subscription failed', error);
        if (onError) onError(error);
      },
    );

    return () => unsubscribe();
  }

  async subscribeComments(
    postId: string,
    onData: (comments: ForumComment[]) => void,
    onError?: (error: any) => void,
  ): Promise<() => void> {
    const normalizedPostId = String(postId || '').trim();
    if (!normalizedPostId || !isFirebaseEnabled()) {
      onData([]);
      return () => {};
    }

    await initFirebaseIfNeeded();
    const firestore = getFirestoreInstance();
    if (!firestore) {
      onData([]);
      return () => {};
    }

    const { collection, onSnapshot, query, where } = await import('firebase/firestore');
    const commentsQuery = query(
      collection(firestore, this.forumCommentsCollectionName),
      where('postId', '==', normalizedPostId),
    );

    const unsubscribe = onSnapshot(
      commentsQuery,
      (snap: any) => {
        const comments = (snap.docs || [])
          .map((docSnap: any) => this.normalizeComment(docSnap.id, docSnap.data?.() || {}))
          .filter((comment: ForumComment) => !comment.hidden)
          .sort((a: ForumComment, b: ForumComment) => a.createdAt - b.createdAt);
        onData(comments);
      },
      (error: any) => {
        console.warn('Forum comments subscription failed', error);
        if (onError) onError(error);
      },
    );

    return () => unsubscribe();
  }

  filterAndSortPosts(
    posts: ForumPost[],
    category: 'all' | ForumCategory,
    sort: ForumSort,
  ): ForumPost[] {
    const normalizedCategory = category === 'all' ? 'all' : this.normalizeCategory(category);
    const rows = posts
      .filter((post) => normalizedCategory === 'all' || post.category === normalizedCategory)
      .slice();

    rows.sort((a, b) => {
      if (sort === 'most-commented') {
        const commentDiff = b.commentCount - a.commentCount;
        if (commentDiff !== 0) return commentDiff;
      }
      return b.createdAt - a.createdAt;
    });

    return rows;
  }

  formatCategoryLabel(category: ForumCategory): string {
    switch (category) {
      case 'help':
        return 'Help';
      case 'showcase':
        return 'Showcase';
      case 'trade':
        return 'Trade';
      default:
        return 'General';
    }
  }

  private requireCurrentUser(): User {
    const current = this.authService.getCurrent();
    if (!current?.email) throw new Error('Please log in to use the forum.');
    return current;
  }

  private getUserDisplayName(user: User): string {
    const displayName = String(user.displayName || user.username || user.email || '').trim();
    return displayName || 'Player';
  }

  private normalizeCategory(category: string): ForumCategory {
    switch (String(category || '').trim().toLowerCase()) {
      case 'help':
      case 'showcase':
      case 'trade':
        return String(category).trim().toLowerCase() as ForumCategory;
      default:
        return 'general';
    }
  }

  private assertAllowedText(value: string, fieldName: string): void {
    const normalized = String(value || '').toLowerCase();
    const matchedWord = this.blockedWords.find((word) => normalized.includes(word));
    if (matchedWord) {
      throw new Error(`${fieldName} contains blocked language. Please reword it and try again.`);
    }
  }

  private assertAllowedFiles(files: File[]): void {
    const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
    for (const file of files) {
      if (!allowedTypes.has(String(file?.type || '').toLowerCase())) {
        throw new Error('Only PNG, JPG, WEBP, and GIF images are allowed.');
      }
      if (Number(file?.size || 0) > this.maxUploadBytes) {
        throw new Error('Each image must be 12 MB or smaller before upload.');
      }
    }
  }

  private async prepareImageForUpload(file: File): Promise<File> {
    const mimeType = String(file?.type || '').toLowerCase();
    if (!file || mimeType === 'image/gif') {
      return file;
    }

    if (file.size <= this.preferredUploadBytes) {
      return file;
    }

    try {
      return await this.compressRasterImage(file);
    } catch (error) {
      console.warn('Forum image compression failed, using original file.', error);
      return file;
    }
  }

  private async compressRasterImage(file: File): Promise<File> {
    const dataUrl = await this.readFileAsDataUrl(file);
    const img = await this.loadImage(dataUrl);
    return this.compressRasterImageFromLoadedImage(
      img,
      file,
      [1600, 1280, 960],
      [0.86, 0.78, 0.7, 0.6, 0.5, 0.42],
      this.preferredUploadBytes,
    );
  }

  private async uploadPostImage(file: File, destPath: string): Promise<string> {
    try {
      return await this.withTimeout(
        uploadFileToStorage(file, destPath),
        this.uploadTimeoutMs,
        'Image upload',
      );
    } catch (uploadError) {
      const fallbackFile = await this.prepareImageForInlineFallback(file);
      if (fallbackFile.size > this.inlineFallbackMaxBytes) {
        throw uploadError;
      }
      return this.readFileAsDataUrl(fallbackFile);
    }
  }

  private async prepareImageForInlineFallback(file: File): Promise<File> {
    const mimeType = String(file?.type || '').toLowerCase();
    if (!file) {
      return file;
    }
    if (file.size <= this.inlineFallbackMaxBytes && mimeType !== 'image/gif') {
      return file;
    }
    if (mimeType === 'image/gif') {
      throw new Error('GIF attachments need Firebase Storage upload to finish. Please try again later or use PNG/JPG/WEBP.');
    }

    try {
      const dataUrl = await this.readFileAsDataUrl(file);
      const img = await this.loadImage(dataUrl);
      return await this.compressRasterImageFromLoadedImage(
        img,
        file,
        [960, 720, 560],
        [0.72, 0.58, 0.46, 0.38],
        this.inlineFallbackMaxBytes,
      );
    } catch {
      return file;
    }
  }

  private async compressRasterImageFromLoadedImage(
    img: HTMLImageElement,
    sourceFile: File,
    maxDimensions: number[],
    qualities: number[],
    targetBytes: number,
  ): Promise<File> {
    const targetType = 'image/webp';
    const baseName = String(sourceFile.name || 'upload').replace(/\.[^.]+$/, '') || 'upload';
    let bestFile = sourceFile;

    for (const maxDimension of maxDimensions) {
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      ctx.drawImage(img, 0, 0, width, height);

      for (const quality of qualities) {
        const blob = await this.canvasToBlob(canvas, targetType, quality);
        if (!blob) continue;

        const nextFile = new File([blob], `${baseName}.webp`, {
          type: targetType,
          lastModified: Date.now(),
        });

        if (nextFile.size < bestFile.size) {
          bestFile = nextFile;
        }

        if (nextFile.size <= targetBytes) {
          return nextFile;
        }
      }
    }

    return bestFile;
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Failed to read image file.'));
      reader.readAsDataURL(file);
    });
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image for compression.'));
      img.src = src;
    });
  }

  private canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), type, quality);
    });
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        window.setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  }

  private normalizePost(id: string, raw: any): ForumPost {
    return {
      id: String(id || '').trim(),
      authorEmail: String(raw?.authorEmail || '').trim().toLowerCase(),
      authorName: String(raw?.authorName || 'Player').trim() || 'Player',
      authorPhotoURL: String(raw?.authorPhotoURL || '').trim(),
      title: String(raw?.title || '').trim(),
      body: String(raw?.body || '').trim(),
      category: this.normalizeCategory(raw?.category),
      imageUrls: Array.isArray(raw?.imageUrls)
        ? raw.imageUrls.map((url: any) => String(url || '').trim()).filter(Boolean)
        : [],
      createdAt: Number.isFinite(Number(raw?.createdAt)) ? Number(raw.createdAt) : 0,
      updatedAt: Number.isFinite(Number(raw?.updatedAt)) ? Number(raw.updatedAt) : 0,
      commentCount: Number.isFinite(Number(raw?.commentCount)) ? Number(raw.commentCount) : 0,
      hidden: !!raw?.hidden,
    };
  }

  private normalizeComment(id: string, raw: any): ForumComment {
    return {
      id: String(id || '').trim(),
      postId: String(raw?.postId || '').trim(),
      authorEmail: String(raw?.authorEmail || '').trim().toLowerCase(),
      authorName: String(raw?.authorName || 'Player').trim() || 'Player',
      authorPhotoURL: String(raw?.authorPhotoURL || '').trim(),
      body: String(raw?.body || '').trim(),
      createdAt: Number.isFinite(Number(raw?.createdAt)) ? Number(raw.createdAt) : 0,
      hidden: !!raw?.hidden,
    };
  }
}
