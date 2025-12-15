"use client";

import { useState } from "react";
import { MessageCircle, Heart, Reply } from "lucide-react";

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

// Mock 评论数据
const mockComments: Comment[] = [
  {
    id: "1",
    user: {
      name: "CryptoTrader",
      avatar: "/images/avatar1.png",
    },
    text: "Based on current market trends and technical analysis, I believe YES is the more likely outcome. The momentum is strong.",
    timestamp: "2 hours ago",
    likes: 12,
    replies: 3,
  },
  {
    id: "2",
    user: {
      name: "MarketMaster",
      avatar: "/images/avatar2.png",
    },
    text: "I'm going with NO. The fundamentals don't support a YES outcome in my opinion.",
    timestamp: "5 hours ago",
    likes: 8,
    replies: 1,
  },
  {
    id: "3",
    user: {
      name: "PredictPro",
      avatar: "/images/avatar3.png",
    },
    text: "This is a close call. I've analyzed both sides and I'm leaning towards YES, but it's risky.",
    timestamp: "1 day ago",
    likes: 15,
    replies: 5,
  },
];

export default function CommentsTab() {
  const [comments, setComments] = useState<Comment[]>(mockComments);
  const [newComment, setNewComment] = useState("");

  const handlePost = () => {
    if (!newComment.trim()) return;

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
          placeholder="写下你的评论..."
          className="w-full px-4 py-3 bg-pm-card border border-pm-border rounded-xl text-white placeholder-pm-text-dim focus:outline-none focus:border-pm-green transition-colors resize-none"
          rows={3}
        />
        <div className="flex justify-end">
          <button
            onClick={handlePost}
            disabled={!newComment.trim()}
            className="px-6 py-2 bg-pm-green hover:bg-green-500 disabled:bg-pm-text-dim disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors"
          >
            Post
          </button>
        </div>
      </div>

      {/* 评论列表 */}
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
    </div>
  );
}

