/**
 * Agent greeting shown when no project is bound yet.
 * Pure text — no form fields. Hunter types a free-form description into the
 * main ChatInput; ChatView handles stub-project creation + first message.
 */
export default function ProjectIntroBubble() {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-full kinetic-gradient flex items-center justify-center shrink-0">
        <span className="text-white text-xs font-bold">CA</span>
      </div>
      <div className="flex-1 max-w-2xl bg-surface-container-lowest border border-outline-variant/10 rounded-tr-3xl rounded-br-3xl rounded-bl-lg border-l-4 border-l-primary px-5 py-4 space-y-3">
        <p className="text-sm text-on-surface leading-relaxed">
          你好，我是 <strong>Coordinator Agent</strong>（CA）。我能帮你：
        </p>
        <ul className="text-sm text-on-surface leading-relaxed space-y-1.5 pl-4 list-disc marker:text-primary">
          <li>解析新的招聘需求，自动建立项目与客户信息</li>
          <li>在人才库中搜索匹配候选人，调度 Evaluator Agent 打分</li>
          <li>调度 Research Agent 生成行业洞察与技能图谱</li>
        </ul>
        <div className="pt-2 border-t border-outline-variant/10">
          <p className="text-sm text-on-surface leading-relaxed">
            要 <strong>开始一个新项目</strong>，直接在下方输入框里告诉我：
            客户是谁、在招什么职位、关键要求 / JD 原文。我会解析这些信息并为你
            建立项目。
          </p>
          <p className="text-[11px] text-secondary mt-2 italic">
            例：「我在给某新能源科技公司招一个高级电池管理系统工程师，
            要求 5 年以上 BMS 经验，熟悉 AUTOSAR…」
          </p>
        </div>
      </div>
    </div>
  )
}
