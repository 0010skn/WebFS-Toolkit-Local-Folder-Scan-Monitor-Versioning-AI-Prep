"use client";

import { useState, useEffect, Fragment } from "react";
import { Transition, Dialog } from "@headlessui/react";
import { useTranslations } from "./LocaleProvider";
import { motion } from "framer-motion";

interface PresetPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPrompt: (prompt: string) => void;
}

interface CategoryInfo {
  id: string;
  name: string;
}

interface PromptInfo {
  key: string;
  text: string;
  category: string;
  categoryName: string;
}

export default function PresetPromptModal({
  isOpen,
  onClose,
  onSelectPrompt,
}: PresetPromptModalProps) {
  const { t, tObject } = useTranslations();
  const [searchQuery, setSearchQuery] = useState("");
  const [allPrompts, setAllPrompts] = useState<PromptInfo[]>([]);
  const [filteredPrompts, setFilteredPrompts] = useState<PromptInfo[]>([]);

  // 获取所有提示类别
  const getCategories = (): CategoryInfo[] => {
    // 从翻译文件中动态获取类别
    const categories: CategoryInfo[] = [];
    const categoriesPath = "presetPrompts.categories";

    // 使用tObject直接获取类别对象
    const categoriesObj = tObject(categoriesPath);

    if (categoriesObj && typeof categoriesObj === "object") {
      // 遍历类别
      for (const categoryKey in categoriesObj) {
        const categoryData = categoriesObj[categoryKey];
        if (
          categoryData &&
          typeof categoryData === "object" &&
          categoryData.name
        ) {
          categories.push({
            id: categoryKey,
            name: categoryData.name,
          });
        }
      }
    }

    // 如果没有获取到类别，提供默认类别
    if (categories.length === 0) {
      return [
        { id: "coreProcesses", name: "核心流程" },
        { id: "components", name: "组件与职责" },
        { id: "dataFlow", name: "数据流路径" },
        { id: "implementation", name: "巧妙实现" },
        { id: "startup", name: "启动与初始化" },
      ];
    }

    return categories;
  };

  // 获取所有提示
  const getAllPrompts = (): PromptInfo[] => {
    const categories = getCategories();
    const prompts: PromptInfo[] = [];

    for (const category of categories) {
      const promptsPath = `presetPrompts.categories.${category.id}.prompts`;
      const promptsObj = tObject(promptsPath);

      if (promptsObj && typeof promptsObj === "object") {
        // 遍历提示
        for (const promptKey in promptsObj) {
          if (typeof promptsObj[promptKey] === "string") {
            prompts.push({
              key: promptKey,
              text: promptsObj[promptKey],
              category: category.id,
              categoryName: category.name,
            });
          }
        }
      } else {
        // 如果没有获取到提示，提供默认提示
        const defaultPrompts: Record<string, { key: string; text: string }[]> =
          {
            coreProcesses: [
              {
                key: "mainFlow",
                text: "请描述当用户执行主要操作时，从前端到后端的典型处理步骤和关键函数调用顺序。",
              },
            ],
            components: [
              {
                key: "overview",
                text: "构成这个项目的主要模块或组件有哪些？请简要描述每个部分的主要功能以及它们如何协作。",
              },
            ],
            dataFlow: [
              {
                key: "tracking",
                text: "追踪一个关键数据片段（如用户输入或业务实体）并解释它是如何生成的，哪些函数处理/转换它，以及它最终流向何处。",
              },
            ],
            implementation: [
              { key: "clever", text: "项目中有哪些巧妙的实现？" },
            ],
            startup: [
              {
                key: "process",
                text: "系统是如何启动和初始化的？请指出首先执行的关键脚本或函数，以及它们主要完成哪些准备工作。",
              },
            ],
          };

        if (defaultPrompts[category.id]) {
          defaultPrompts[category.id].forEach((prompt) => {
            prompts.push({
              ...prompt,
              category: category.id,
              categoryName: category.name,
            });
          });
        }
      }
    }

    return prompts;
  };

  // 初始化和搜索提示
  useEffect(() => {
    const prompts = getAllPrompts();
    setAllPrompts(prompts);

    if (searchQuery) {
      const filtered = prompts.filter((prompt) =>
        prompt.text.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredPrompts(filtered);
    } else {
      setFilteredPrompts(prompts);
    }
  }, [searchQuery, isOpen]);

  // 当modal打开时重新加载提示
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      const prompts = getAllPrompts();
      setAllPrompts(prompts);
      setFilteredPrompts(prompts);
    }
  }, [isOpen]);

  // 处理提示点击
  const handlePromptClick = (prompt: string) => {
    onSelectPrompt(prompt);
    onClose();
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[9999]" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[9998]" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto z-[9999]">
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
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 text-left align-middle shadow-xl transition-all z-[9999]">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900 dark:text-white flex items-center"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                      />
                    </svg>
                    {t("presetPrompts.title")}
                  </Dialog.Title>
                  <button
                    type="button"
                    className="text-gray-400 hover:text-gray-500 focus:outline-none"
                    onClick={onClose}
                  >
                    <span className="sr-only">Close</span>
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <div className="px-6 py-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    {t("presetPrompts.description")}
                  </p>

                  <div className="relative w-full mb-4">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <svg
                        className="w-4 h-4 text-gray-500 dark:text-gray-400"
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 20 20"
                      >
                        <path
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"
                        />
                      </svg>
                    </div>
                    <input
                      type="search"
                      className="block w-full p-4 pl-10 text-sm text-gray-900 border border-gray-300 rounded-lg bg-gray-50 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                      placeholder="搜索提示..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <div className="mt-4 max-h-[60vh] overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {filteredPrompts.length > 0 ? (
                        filteredPrompts.map((prompt, index) => (
                          <motion.div
                            key={`${prompt.category}-${prompt.key}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                              duration: 0.2,
                              delay: index * 0.03,
                            }}
                            className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer h-full"
                            onClick={() => handlePromptClick(prompt.text)}
                          >
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              {prompt.text}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                              {prompt.categoryName}
                            </p>
                          </motion.div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400 col-span-2">
                          没有找到匹配的提示。
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700 flex justify-end">
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-transparent bg-blue-100 px-4 py-2 text-sm font-medium text-blue-900 hover:bg-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:bg-blue-900 dark:text-blue-100 dark:hover:bg-blue-800"
                    onClick={onClose}
                  >
                    {t("presetPrompts.close")}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
