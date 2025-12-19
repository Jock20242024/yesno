"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import UserProfileHeader from "@/components/user/UserProfileHeader";
import UserActivityTable from "@/components/user/UserActivityTable";

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const user_id = params.user_id as string;

  // Mock 用户数据 - 实际应该从 API 获取
  const userData = {
    userId: user_id,
    userName: user_id,
    profit: -813.21,
    positionsValue: "$2,450.00",
    biggestWin: "+$1,250.00",
    predictions: 127,
    joinDate: "Jan 15, 2024",
  };

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

      {/* 用户摘要组件 */}
      <div className="mb-8">
        <UserProfileHeader {...userData} />
      </div>

      {/* 活动表格组件 */}
      <div>
        <UserActivityTable />
      </div>
    </div>
  );
}

