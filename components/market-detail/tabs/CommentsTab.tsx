"use client";

import { useState } from "react";
import { MessageCircle, Heart, Reply } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

interface CommentsTabProps {
  marketId?: string;
}

interface Comment {
  id: string;
  user: {
    name: string;
    avatar: string;
  };
  text: string;
  timestamp: string;
  likes: number;
  replies: number;
}

export default function CommentsTab({ marketId }: CommentsTabProps) {
  const { t } = useLanguage();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // TODO: 实现真实的评论功能（需要后端API支持）
  // 当前版本：评论功能暂未实现，显示空状态提示
  const handlePost = () => {
    if (!newComment.trim()) return;
    
    // 暂时使用本地状态（后续需要调用API保存评论）
    const comment: Comment = {
      id: Date.now().toString(),
      user: {
        name: "CurrentUser",
        avatar: "/images/avatar.png",
      },
      text: newComment,
      timestamp: "just now",
      likes: 0,
      replies: 0,
    };

    setComments([comment, ...comments]);
    setNewComment("");
  };

  const handleLike = (commentId: string) => {
    setComments(
      comments.map((comment) =>
        comment.id === commentId
          ? { ...comment, likes: comment.likes + 1 }
          : comment
      )
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 评论输入区 */}
      <div className="flex flex-col gap-3">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={t('market.comments.write_comment')}
          className="w-full px-4 py-3 bg-pm-card border border-pm-border rounded-xl text-white placeholder-pm-text-dim focus:outline-none focus:border-pm-green transition-colors resize-none"
          rows={3}
        />
        <div className="flex justify-end">
          <button
            onClick={handlePost}
            disabled={!newComment.trim()}
            className="px-6 py-2 bg-pm-green hover:bg-green-500 disabled:bg-pm-text-dim disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors"
          >
            {t('market.comments.post')}
          </button>
        </div>
      </div>

      {/* 评论列表 */}
      {comments.length === 0 ? (
        <div className="text-center py-12 text-pm-text-dim">
          <p className="mb-2">{t('market.comments.no_comments')}</p>
          <p className="text-xs">{t('market.comments.coming_soon')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {comments.map((comment) => (
          <div
            key={comment.id}
            className="p-4 bg-pm-card border border-pm-border rounded-xl hover:bg-pm-card-hover transition-colors"
          >
            <div className="flex gap-3">
              {/* 用户头像 */}
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pm-green via-primary to-pm-blue flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {comment.user.name.charAt(0).toUpperCase()}
              </div>

              {/* 评论内容 */}
              <div className="flex-1 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium text-sm">
                    {comment.user.name}
                  </span>
                  <span className="text-pm-text-dim text-xs">
                    {comment.timestamp}
                  </span>
                </div>
                <p className="text-white text-sm leading-relaxed">
                  {comment.text}
                </p>
                <div className="flex items-center gap-4 mt-2">
                  <button
                    onClick={() => handleLike(comment.id)}
                    className="flex items-center gap-1.5 text-pm-text-dim hover:text-pm-green transition-colors"
                  >
                    <Heart className="w-4 h-4" />
                    <span className="text-xs">{comment.likes}</span>
                  </button>
                  <button className="flex items-center gap-1.5 text-pm-text-dim hover:text-primary transition-colors">
                    <Reply className="w-4 h-4" />
                    <span className="text-xs">{comment.replies}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
        </div>
      )}
    </div>
  );
}

