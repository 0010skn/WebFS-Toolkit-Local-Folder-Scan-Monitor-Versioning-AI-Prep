"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import StatisticsContent from "@/components/StatisticsContent";

export default function StatisticsPage() {
  const router = useRouter();

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold dark:text-white">项目统计</h1>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors duration-300"
        >
          返回
        </button>
      </div>

      <StatisticsContent />
    </div>
  );
}
