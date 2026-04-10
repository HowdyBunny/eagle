# 项目开发待办 (TODO)

## 核心架构 (状态管理重构)
- **问题**：`bootstrapping` 等状态存储在 `ChatView` 本地，导致用户切换页面时组件卸载，丢失后台运行状态，产生空白 UI。bootstrapping、bootstrapStatus、setError 这些是 ChatView 的本地 React state，绑定在那个组件实例上。用户切页面 → 旧 ChatView unmount → 新页面 mount → 用户切回来 → 新的 ChatView 实例重新挂载，它的 bootstrapping 是 false，不知道后台还有个正在跑的 bootstrap。结果：用户回来看到空白聊天，没有 spinner，没有进度。
done 触发后 loadHistory 执行 → 消息出现
selectProject 在全局 store 里所以项目会正确选中
根本原因：bootstrap 状态在组件本地，而 SSE 聊天的状态在 Zustand 全局 store 里，所以 SSE 天然能跨导航存活。
- [ ] **解决方案**：
    - 将 `bootstrapping`、`bootstrapStatus`、`setError` 移入全局 **Zustand** Store。
    - 统一 SSE 聊天状态与 UI 引导状态，确保跨页面导航后 Spinner 和进度能正确显示。
    - 优化 `done` 触发后的 `loadHistory` 自动挂载逻辑。

## 数据增强 (LinkedIn 深度抓取)
- **问题**：部分信息（如全量工作经验、教育经历）需要点击跳转才能获取，当前抓取不完整。
- [ ] **解决方案**：
    - 设计后台静默 Fetch 机制：
        - 模块 ③：Fetch `/details/experience/` (约 1s)
        - 模块 ④：Fetch `/details/education/` (并行，约 1s)
    - 编写数据合并逻辑，实现结构化完整输出。

## 招聘平台适配 (新增支持)
- **问题**：目前项目尚未覆盖国内主流招聘平台。
- [ ] **解决方案**：
    - 启动对其他平台适配开发。
    - 调研并解析猎聘详情页数据结构。