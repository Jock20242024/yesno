"use client";

import { useParams } from "next/navigation";
import UserProfileHeader from "@/components/user/UserProfileHeader";
import UserActivityTable from "@/components/user/UserActivityTable";

export default function UserProfilePage() {
  const params = useParams();
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

