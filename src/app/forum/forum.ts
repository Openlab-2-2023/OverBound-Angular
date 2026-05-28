import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ForumCategory,
  ForumComment,
  ForumPost,
  ForumService,
  ForumSort,
} from '../services/forum.service';

@Component({
  selector: 'app-forum',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './forum.html',
  styleUrl: './forum.css',
})
export class ForumComponent implements OnInit, OnDestroy {
  posts: ForumPost[] = [];
  commentsByPost: Record<string, ForumComment[]> = {};
  replySeenState: Record<string, number> = {};
  categoryFilter: 'all' | ForumCategory = 'all';
  sortFilter: ForumSort = 'newest';
  postCategory: ForumCategory = 'help';
  postCategoryOpen = false;
  categoryFilterOpen = false;
  sortFilterOpen = false;
  postTitle = '';
  postBody = '';
  selectedFiles: File[] = [];
  selectedFileNames: string[] = [];
  loading = true;
  creatingPost = false;
  feedError = '';
  postFeedback = '';
  commentFeedback = '';
  openReplyThreads: Record<string, boolean> = {};
  commentDrafts: Record<string, string> = {};
  commentSubmitting: Record<string, boolean> = {};
  private postsUnsubscribe: (() => void) | null = null;
  private commentsUnsubscribes = new Map<string, () => void>();
  private onUserUpdatedListener: EventListener | null = null;

  constructor(
    private forumService: ForumService,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit(): Promise<void> {
    this.replySeenState = this.forumService.getReplySeenState();
    this.onUserUpdatedListener = () => this.cdr.detectChanges();
    window.addEventListener('ob:user-updated', this.onUserUpdatedListener);
    await this.subscribeToPosts();
  }

  ngOnDestroy(): void {
    if (this.postsUnsubscribe) {
      this.postsUnsubscribe();
      this.postsUnsubscribe = null;
    }
    for (const unsubscribe of this.commentsUnsubscribes.values()) {
      unsubscribe();
    }
    this.commentsUnsubscribes.clear();
    if (this.onUserUpdatedListener) {
      window.removeEventListener('ob:user-updated', this.onUserUpdatedListener);
      this.onUserUpdatedListener = null;
    }
  }

  get filteredPosts(): ForumPost[] {
    return this.forumService.filterAndSortPosts(this.posts, this.categoryFilter, this.sortFilter);
  }

  get loggedIn(): boolean {
    return this.forumService.isLoggedIn();
  }

  get currentUserName(): string {
    const current = this.forumService.getCurrentUser();
    return String(current?.displayName || current?.username || current?.email || 'Player').trim() || 'Player';
  }

  get currentUserPhoto(): string {
    return String(this.forumService.getCurrentUser()?.photoURL || '').trim();
  }

  get currentUserInitial(): string {
    return (this.currentUserName.charAt(0) || 'P').toUpperCase();
  }

  formatCategoryLabel(category: ForumCategory): string {
    return this.forumService.formatCategoryLabel(category);
  }

  get postCategoryLabel(): string {
    return this.formatCategoryLabel(this.postCategory);
  }

  get categoryFilterLabel(): string {
    return this.categoryFilter === 'all' ? 'All' : this.formatCategoryLabel(this.categoryFilter);
  }

  get sortFilterLabel(): string {
    return this.sortFilter === 'most-commented' ? 'Most Commented' : 'Newest';
  }

  get unreadReplyThreadCount(): number {
    return this.posts.filter((post) => this.hasUnreadReplies(post)).length;
  }

  getCommentsForPost(postId: string): ForumComment[] {
    return this.commentsByPost[String(postId || '').trim()] || [];
  }

  getPostInitial(post: ForumPost): string {
    return (String(post.authorName || 'P').trim().charAt(0) || 'P').toUpperCase();
  }

  hasUnreadReplies(post: ForumPost): boolean {
    const comments = this.getCommentsForPost(post.id);
    return this.forumService.hasUnreadRepliesForPost(post.id, comments, this.replySeenState);
  }

  isReplyThreadOpen(postId: string): boolean {
    return !!this.openReplyThreads[String(postId || '').trim()];
  }

  toggleReplyThread(postId: string): void {
    const normalizedPostId = String(postId || '').trim();
    if (!normalizedPostId) return;
    this.openReplyThreads[normalizedPostId] = !this.openReplyThreads[normalizedPostId];
    if (this.openReplyThreads[normalizedPostId]) {
      this.markPostRepliesSeen(normalizedPostId);
    }
  }

  togglePostCategoryMenu(): void {
    this.postCategoryOpen = !this.postCategoryOpen;
    if (this.postCategoryOpen) {
      this.categoryFilterOpen = false;
      this.sortFilterOpen = false;
    }
  }

  toggleCategoryFilterMenu(): void {
    this.categoryFilterOpen = !this.categoryFilterOpen;
    if (this.categoryFilterOpen) {
      this.postCategoryOpen = false;
      this.sortFilterOpen = false;
    }
  }

  toggleSortFilterMenu(): void {
    this.sortFilterOpen = !this.sortFilterOpen;
    if (this.sortFilterOpen) {
      this.postCategoryOpen = false;
      this.categoryFilterOpen = false;
    }
  }

  selectPostCategory(category: ForumCategory): void {
    this.postCategory = category;
    this.postCategoryOpen = false;
  }

  selectCategoryFilter(category: 'all' | ForumCategory): void {
    this.categoryFilter = category;
    this.categoryFilterOpen = false;
  }

  selectSortFilter(sort: ForumSort): void {
    this.sortFilter = sort;
    this.sortFilterOpen = false;
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const files = Array.from(input?.files || []).slice(0, 4);
    this.selectedFiles = files;
    this.selectedFileNames = files.map((file) => file.name);
  }

  async submitPost(): Promise<void> {
    if (this.creatingPost) return;
    this.creatingPost = true;
    this.postFeedback = '';
    this.feedError = '';

    try {
      await this.forumService.createPost({
        title: this.postTitle,
        body: this.postBody,
        category: this.postCategory,
        files: this.selectedFiles,
      });
      this.postTitle = '';
      this.postBody = '';
      this.postCategory = 'help';
      this.selectedFiles = [];
      this.selectedFileNames = [];
      this.postFeedback = 'Post published.';
    } catch (error: any) {
      this.feedError = this.getDisplayErrorMessage(error, 'Could not publish the post.');
    } finally {
      this.creatingPost = false;
      this.cdr.detectChanges();
    }
  }

  async submitComment(postId: string): Promise<void> {
    const normalizedPostId = String(postId || '').trim();
    if (!normalizedPostId || this.commentSubmitting[normalizedPostId]) return;

    this.commentSubmitting[normalizedPostId] = true;
    this.commentFeedback = '';
    this.feedError = '';

    try {
      await this.forumService.addComment(normalizedPostId, this.commentDrafts[normalizedPostId] || '');
      this.commentDrafts[normalizedPostId] = '';
      this.commentFeedback = 'Reply added.';
      this.markPostRepliesSeen(normalizedPostId);
    } catch (error: any) {
      this.feedError = this.getDisplayErrorMessage(error, 'Could not add the reply.');
    } finally {
      this.commentSubmitting[normalizedPostId] = false;
      this.cdr.detectChanges();
    }
  }

  onCommentKeydown(event: KeyboardEvent, postId: string): void {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    void this.submitComment(postId);
  }

  private markPostRepliesSeen(postId: string): void {
    const normalizedPostId = String(postId || '').trim();
    if (!normalizedPostId) return;
    const seenAt = Date.now();
    this.forumService.markPostRepliesSeen(normalizedPostId, seenAt);
    this.replySeenState = {
      ...this.replySeenState,
      [normalizedPostId]: seenAt,
    };
    this.cdr.detectChanges();
  }

  trackPost(_index: number, post: ForumPost): string {
    return post.id;
  }

  trackComment(_index: number, comment: ForumComment): string {
    return comment.id;
  }

  private async subscribeToPosts(): Promise<void> {
    this.loading = true;
    this.feedError = '';
    try {
      this.postsUnsubscribe = await this.forumService.subscribePosts(
        (posts) => {
          this.posts = posts;
          void this.syncCommentSubscriptions(posts);
          this.loading = false;
          this.cdr.detectChanges();
        },
        (error) => {
          this.feedError = this.getDisplayErrorMessage(error, 'Could not load the forum feed.');
          this.loading = false;
          this.cdr.detectChanges();
        },
      );
    } catch (error: any) {
      this.feedError = this.getDisplayErrorMessage(error, 'Could not load the forum feed.');
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  private getDisplayErrorMessage(error: any, fallback: string): string {
    const message = String(error?.message || '').trim();
    const code = String(error?.code || '').trim().toLowerCase();
    const normalized = `${code} ${message}`.toLowerCase();

    if (
      normalized.includes('permission-denied') ||
      normalized.includes('insufficient permissions') ||
      normalized.includes('missing or insufficient permissions')
    ) {
      return 'Forum database access is blocked by Firebase rules right now.';
    }

    return message || fallback;
  }

  private async syncCommentSubscriptions(posts: ForumPost[]): Promise<void> {
    const desiredIds = new Set(posts.map((post) => post.id));

    for (const [postId, unsubscribe] of this.commentsUnsubscribes.entries()) {
      if (!desiredIds.has(postId)) {
        unsubscribe();
        this.commentsUnsubscribes.delete(postId);
        delete this.commentsByPost[postId];
      }
    }

    for (const post of posts) {
      if (this.commentsUnsubscribes.has(post.id)) continue;
      const unsubscribe = await this.forumService.subscribeComments(
        post.id,
        (comments) => {
          this.commentsByPost[post.id] = comments;
          this.cdr.detectChanges();
        },
        () => {
          this.commentsByPost[post.id] = [];
          this.cdr.detectChanges();
        },
      );
      this.commentsUnsubscribes.set(post.id, unsubscribe);
    }
  }
}
