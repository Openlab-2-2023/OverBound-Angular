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
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const safeName = String(file.name || 'upload')
        .replace(/[^a-z0-9._-]/gi, '_')
        .slice(-80);
      const url = await uploadFileToStorage(
        file,
        `forum_posts/${encodeURIComponent(current.email)}/${now}_${i}_${safeName}`,
      );
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
      if (Number(file?.size || 0) > 4 * 1024 * 1024) {
        throw new Error('Each image must be 4 MB or smaller.');
      }
    }
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
