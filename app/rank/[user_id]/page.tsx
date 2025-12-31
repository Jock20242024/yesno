"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import UserProfileHeader from "@/components/user/UserProfileHeader";
import UserActivityTable from "@/components/user/UserActivityTable";
import { formatUSD } from "@/lib/utils";

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const user_id = params.user_id as string;

  const [userData, setUserData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // 注意：这里应该使用用户名或 ID 查找用户
        // 由于排行榜链接使用的是 username，我们需要先找到用户的 ID
        // 或者修改 API 支持通过 username 查找
        // 目前先尝试直接使用 user_id（可能是 ID 或 username）
        const response = await fetch(`/api/users/${user_id}`);
        
        if (!response.ok) {
          // 如果直接使用 user_id 失败，可能需要先通过用户名查找
          // 这里先尝试直接使用
          throw new Error("Failed to fetch user data");
        }

        const result = await response.json();
        if (result.success && result.data) {
          const data = result.data;
          setUserData({
            userId: data.id,
            userName: data.email.split('@')[0],
            profit: data.totalProfitLoss || 0,
            positionsValue: formatUSD(data.positionsValue || 0),
            biggestWin: data.biggestWin > 0 ? `+${formatUSD(data.biggestWin)}` : formatUSD(0),
            predictions: data.predictions || 0,
            joinDate: new Date(data.createdAt).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'short', 
              day: 'numeric' 
            }),
          });
        } else {
          throw new Error(result.error || "Invalid response format");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error fetching user data.");
        console.error("Error fetching user data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    if (user_id) {
      fetchUserData();
    }
  }, [user_id]);

  return (
    <div className="flex-1 w-full max-w-[1600px] mx-auto px-6 py-8">
      {/* 返回排行榜按钮 */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/rank')}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/50 hover:bg-black/70 border border-pm-border hover:border-pm-green transition-all group"
        >
          <ArrowLeft className="w-4 h-4 text-pm-text-dim group-hover:text-white transition-colors" />
          <span className="text-sm text-pm-text-dim group-hover:text-white transition-colors">返回排行榜</span>
        </button>
      </div>

      {/* 加载状态 */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-pm-green mr-2" />
          <span className="text-zinc-400">加载中...</span>
        </div>
      )}

      {/* 错误状态 */}
      {error && !isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-red-500 font-medium mb-2">加载失败</p>
            <p className="text-zinc-400 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* 用户数据 */}
      {!isLoading && !error && userData && (
        <>
          {/* 用户摘要组件 */}
          <div className="mb-8">
            <UserProfileHeader {...userData} />
          </div>

          {/* 活动表格组件 */}
          <div>
            <UserActivityTable userId={userData.userId} />
          </div>
        </>
      )}
    </div>
  );
}

