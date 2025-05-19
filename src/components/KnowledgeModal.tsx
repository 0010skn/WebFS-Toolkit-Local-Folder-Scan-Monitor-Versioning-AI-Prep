"use client";

import { Fragment, useEffect, useState, useRef } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { useAtom } from "jotai";
import { motion } from "framer-motion";
import {
  knowledgeModalOpenAtom,
  knowledgeStoreAtom,
  knowledgeEditingAtom,
} from "@/lib/store";
import {
  getAllKnowledgeEntries,
  addKnowledgeEntry,
  updateKnowledgeEntry,
  deleteKnowledgeEntry,
  KnowledgeEntry,
} from "@/lib/knowledgeService";
import {
  downloadKnowledgeLibrary,
  importKnowledgeFile,
  parseMarkdownFile,
  importZipFile,
} from "@/lib/knowledgeUtils";
import Markdown from "markdown-to-jsx";
import { useTranslations } from "./LocaleProvider";

// 定义导入结果接口
interface ImportResult {
  success: boolean;
  message: string;
  total?: number;
  added?: number;
  updated?: number;
}

export default function KnowledgeModal() {
  const { t } = useTranslations();
  const [isOpen, setIsOpen] = useAtom(knowledgeModalOpenAtom);
  const [knowledgeStore, setKnowledgeStore] = useAtom(knowledgeStoreAtom);
  const [editing, setEditing] = useAtom(knowledgeEditingAtom);

  const [searchQuery, setSearchQuery] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [activeTab, setActiveTab] = useState<"view" | "edit">("view");
  const [isProcessingZip, setIsProcessingZip] = useState(false);

  const mdFileInputRef = useRef<HTMLInputElement>(null);
  const knFileInputRef = useRef<HTMLInputElement>(null);
  const zipFileInputRef = useRef<HTMLInputElement>(null);

  // 加载知识库条目
  const loadKnowledgeEntries = async () => {
    try {
      setKnowledgeStore((prev) => ({ ...prev, isLoading: true, error: null }));
      const entries = await getAllKnowledgeEntries();
      setKnowledgeStore((prev) => ({ ...prev, entries, isLoading: false }));
    } catch (error) {
      console.error("加载知识库失败:", error);
      setKnowledgeStore((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "加载知识库失败",
      }));
    }
  };

  // 初始加载
  useEffect(() => {
    if (isOpen) {
      loadKnowledgeEntries();
    }
  }, [isOpen]);

  // 过滤知识条目
  const filteredEntries = knowledgeStore.entries.filter((entry) => {
    if (!searchQuery.trim()) return true;

    const lowerQuery = searchQuery.toLowerCase();
    return (
      entry.title.toLowerCase().includes(lowerQuery) ||
      entry.content.toLowerCase().includes(lowerQuery)
    );
  });

  // 创建新条目
  const createNewEntry = () => {
    setEditing({
      isEditing: true,
      entryId: null,
      title: "",
      content: "",
    });
    setActiveTab("edit");
  };

  // 编辑条目
  const editEntry = (entry: KnowledgeEntry) => {
    setEditing({
      isEditing: true,
      entryId: entry.id,
      title: entry.title,
      content: entry.content,
    });
    setActiveTab("edit");
  };

  // 查看条目
  const viewEntry = (entry: KnowledgeEntry) => {
    setKnowledgeStore((prev) => ({ ...prev, currentEntry: entry }));
    setActiveTab("view");
  };

  // 删除条目
  const handleDeleteEntry = async (id: string) => {
    if (!window.confirm(t("knowledgeModal.deletionConfirm"))) return;

    try {
      await deleteKnowledgeEntry(id);

      // 如果删除的是当前查看的条目，清除当前条目
      if (knowledgeStore.currentEntry?.id === id) {
        setKnowledgeStore((prev) => ({ ...prev, currentEntry: null }));
      }

      await loadKnowledgeEntries();
    } catch (error) {
      console.error("删除知识条目失败:", error);
      alert(
        t("knowledgeModal.deletionFailed", {
          message: error instanceof Error ? error.message : "未知错误",
        })
      );
    }
  };

  // 保存条目
  const saveEntry = async () => {
    try {
      if (!editing.title.trim()) {
        alert(t("knowledgeModal.titleRequired"));
        return;
      }

      if (editing.entryId) {
        // 更新现有条目
        await updateKnowledgeEntry(editing.entryId, {
          title: editing.title,
          content: editing.content,
        });
      } else {
        // 创建新条目
        await addKnowledgeEntry({
          title: editing.title,
          content: editing.content,
        });
      }

      // 重新加载条目并重置编辑状态
      await loadKnowledgeEntries();
      setEditing({
        isEditing: false,
        entryId: null,
        title: "",
        content: "",
      });
      setActiveTab("view");
    } catch (error) {
      console.error("保存知识条目失败:", error);
      alert(
        t("knowledgeModal.saveFailed", {
          message: error instanceof Error ? error.message : "未知错误",
        })
      );
    }
  };

  // 取消编辑
  const cancelEdit = () => {
    setEditing({
      isEditing: false,
      entryId: null,
      title: "",
      content: "",
    });
    setActiveTab("view");
  };

  // 上传Markdown文件
  const handleMdFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const { title, content } = await parseMarkdownFile(file);

      setEditing({
        isEditing: true,
        entryId: null,
        title,
        content,
      });

      setActiveTab("edit");
    } catch (error) {
      console.error("读取Markdown文件失败:", error);
      alert(
        t("knowledgeModal.importFailed", {
          message: error instanceof Error ? error.message : "未知错误",
        })
      );
    }

    // 重置文件输入，以便可以再次选择同一文件
    if (mdFileInputRef.current) {
      mdFileInputRef.current.value = "";
    }
  };

  // 上传ZIP文件
  const handleZipFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessingZip(true);
    setImportResult(null);

    try {
      const result = await importZipFile(file);

      setImportResult({
        success: true,
        message: t("knowledgeModal.zipImportSuccess", {
          total: String(result.imported),
        }),
      });

      // 重新加载条目
      await loadKnowledgeEntries();
    } catch (error) {
      console.error("导入ZIP文件失败:", error);
      setImportResult({
        success: false,
        message: t("knowledgeModal.importFailed", {
          message: error instanceof Error ? error.message : "未知错误",
        }),
      });
    } finally {
      setIsProcessingZip(false);

      // 重置文件输入
      if (zipFileInputRef.current) {
        zipFileInputRef.current.value = "";
      }
    }
  };

  // 导入知识库
  const handleImportKnowledge = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportResult(null);

    try {
      const result = await importKnowledgeFile(file);

      setImportResult({
        success: true,
        message: t("knowledgeModal.importSuccess", {
          total: String(result.total),
          added: String(result.added),
          updated: String(result.updated),
        }),
      });

      // 重新加载条目
      await loadKnowledgeEntries();
    } catch (error) {
      console.error("导入知识库失败:", error);
      setImportResult({
        success: false,
        message: t("knowledgeModal.importFailed", {
          message: error instanceof Error ? error.message : "未知错误",
        }),
      });
    } finally {
      setIsImporting(false);

      // 重置文件输入
      if (knFileInputRef.current) {
        knFileInputRef.current.value = "";
      }
    }
  };

  // 导出知识库
  const handleExportKnowledge = async () => {
    try {
      await downloadKnowledgeLibrary();
    } catch (error) {
      console.error("导出知识库失败:", error);
      alert(
        t("knowledgeModal.exportFailed", {
          message: error instanceof Error ? error.message : "未知错误",
        })
      );
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-50"
        onClose={() => setIsOpen(false)}
      >
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-5xl transform rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="div"
                  className="flex justify-between items-center border-b dark:border-gray-700 pb-4 mb-4"
                >
                  <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100">
                    {t("knowledgeModal.title")}
                  </h3>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </Dialog.Title>

                {/* 承诺声明 */}
                <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 p-3 mb-4 rounded-md text-sm">
                  <p className="font-medium">
                    <span className="inline-flex items-center mr-1">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 mr-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </span>
                    {t("knowledgeModal.dataSecurityPromise")}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[600px]">
                  {/* 左侧列表 */}
                  <div className="border dark:border-gray-700 rounded-lg overflow-hidden h-full flex flex-col">
                    <div className="p-3 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600 flex flex-col gap-3">
                      <div className="flex items-center">
                        <input
                          type="text"
                          placeholder={t("knowledgeModal.searchPlaceholder")}
                          className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                      <div className="flex justify-between gap-2">
                        <button
                          onClick={createNewEntry}
                          className="flex items-center justify-center px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-md flex-1"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4 mr-1"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 4v16m8-8H4"
                            />
                          </svg>
                          {t("knowledgeModal.createNew")}
                        </button>
                        <button
                          onClick={() => mdFileInputRef.current?.click()}
                          className="flex items-center justify-center px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md flex-1"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4 mr-1"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                            />
                          </svg>
                          {t("knowledgeModal.uploadMd")}
                        </button>
                        <button
                          onClick={() => zipFileInputRef.current?.click()}
                          className="flex items-center justify-center px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-md flex-1"
                          disabled={isProcessingZip}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4 mr-1"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                            />
                          </svg>
                          {isProcessingZip
                            ? t("knowledgeModal.processingZip")
                            : t("knowledgeModal.uploadZip")}
                        </button>
                        <input
                          ref={mdFileInputRef}
                          type="file"
                          accept=".md"
                          onChange={handleMdFileUpload}
                          className="hidden"
                        />
                        <input
                          ref={zipFileInputRef}
                          type="file"
                          accept=".zip"
                          onChange={handleZipFileUpload}
                          className="hidden"
                        />
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      {knowledgeStore.isLoading ? (
                        <div className="flex items-center justify-center h-full">
                          <svg
                            className="animate-spin h-5 w-5 text-gray-500"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                        </div>
                      ) : filteredEntries.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                          {searchQuery
                            ? t("knowledgeModal.noMatchMessage")
                            : t("knowledgeModal.emptyMessage")}
                        </div>
                      ) : (
                        <ul className="divide-y dark:divide-gray-700">
                          {filteredEntries.map((entry) => (
                            <li
                              key={entry.id}
                              className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                              <div
                                className="cursor-pointer"
                                onClick={() => viewEntry(entry)}
                              >
                                <h4 className="font-medium text-gray-900 dark:text-gray-100">
                                  {entry.title}
                                </h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                  {entry.content.substring(0, 60)}...
                                </p>
                                <div className="flex justify-between items-center mt-2">
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {t("knowledgeModal.lastScanTime")}{" "}
                                    {new Date(entry.updatedAt).toLocaleString()}
                                  </span>
                                  <div className="flex space-x-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        editEntry(entry);
                                      }}
                                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 p-1"
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-4 w-4"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                        />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteEntry(entry.id);
                                      }}
                                      className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1"
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-4 w-4"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                        />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-700 border-t dark:border-gray-600 flex justify-between">
                      <button
                        onClick={() => knFileInputRef.current?.click()}
                        className="flex items-center justify-center px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-md"
                        disabled={isImporting}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 mr-1"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                          />
                        </svg>
                        {isImporting
                          ? t("knowledgeModal.importing")
                          : t("knowledgeModal.importLib")}
                      </button>
                      <input
                        ref={knFileInputRef}
                        type="file"
                        accept=".kn"
                        onChange={handleImportKnowledge}
                        className="hidden"
                      />
                      <button
                        onClick={handleExportKnowledge}
                        className="flex items-center justify-center px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded-md"
                        disabled={knowledgeStore.entries.length === 0}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 mr-1"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                        {t("knowledgeModal.exportLib")}
                      </button>
                    </div>
                  </div>

                  {/* 右侧内容区 */}
                  <div className="md:col-span-2 border dark:border-gray-700 rounded-lg overflow-hidden h-full flex flex-col">
                    {/* 标签页 */}
                    <div className="flex border-b dark:border-gray-700">
                      <button
                        className={`px-4 py-3 text-sm font-medium focus:outline-none ${
                          activeTab === "view"
                            ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                            : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                        }`}
                        onClick={() =>
                          !editing.isEditing && setActiveTab("view")
                        }
                      >
                        {t("resultDisplay.view")}
                      </button>
                      <button
                        className={`px-4 py-3 text-sm font-medium focus:outline-none ${
                          activeTab === "edit"
                            ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                            : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                        }`}
                        onClick={() =>
                          editing.isEditing && setActiveTab("edit")
                        }
                      >
                        {editing.entryId
                          ? t("knowledgeModal.edit")
                          : t("knowledgeModal.newEntry")}
                      </button>
                    </div>

                    {/* 内容区 */}
                    <div className="flex-1 overflow-y-auto">
                      {activeTab === "view" ? (
                        // 查看模式
                        knowledgeStore.currentEntry ? (
                          <div className="p-4">
                            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                              {knowledgeStore.currentEntry.title}
                            </h2>
                            <div className="prose dark:prose-invert prose-sm max-w-none">
                              <Markdown>
                                {knowledgeStore.currentEntry.content}
                              </Markdown>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                            <div className="text-center p-6">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-12 w-12 mx-auto mb-4 text-gray-400"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={1}
                                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                              </svg>
                              <p>{t("knowledgeModal.selectOrCreateMessage")}</p>
                            </div>
                          </div>
                        )
                      ) : (
                        // 编辑模式
                        <div className="p-4">
                          <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              {t("knowledgeModal.titleLabel")}
                              <span className="text-red-500 ml-1">*</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400 italic ml-2">
                                ({t("knowledgeModal.titleImportant")})
                              </span>
                            </label>
                            <input
                              type="text"
                              value={editing.title}
                              onChange={(e) =>
                                setEditing((prev) => ({
                                  ...prev,
                                  title: e.target.value,
                                }))
                              }
                              className="w-full px-3 py-2 border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                              placeholder={t("knowledgeModal.titlePlaceholder")}
                            />
                          </div>
                          <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              {t("knowledgeModal.contentLabel")}
                            </label>
                            <textarea
                              value={editing.content}
                              onChange={(e) =>
                                setEditing((prev) => ({
                                  ...prev,
                                  content: e.target.value,
                                }))
                              }
                              className="w-full px-3 py-2 border dark:border-gray-600 rounded-md h-96 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono"
                              placeholder={t(
                                "knowledgeModal.contentPlaceholder"
                              )}
                            />
                          </div>
                          <div className="flex justify-end space-x-3">
                            <button
                              onClick={cancelEdit}
                              className="px-4 py-2 border dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              {t("resultDisplay.cancel")}
                            </button>
                            <button
                              onClick={saveEntry}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
                            >
                              {t("settings.save")}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 导入结果提示 */}
                {importResult && (
                  <div
                    className={`mt-4 p-3 rounded-md ${
                      importResult.success
                        ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-200"
                        : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-200"
                    }`}
                  >
                    {importResult.message}
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
