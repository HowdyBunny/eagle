用于监控LLM的输入和输出：
使用方式：
```bash
tail -f logs/llm_trace.jsonl | python -m json.tool

# 按照method过滤
cat logs/llm_trace.jsonl | jq 'select(.method=="agentic_loop_stream")'

# 查看最后一次调用的完整messages
cat logs/llm_trace.jsonl | jq -s 'last | .messages'

# 查看报错
cat logs/llm_trace.jsonl | jq 'select(.error != null)'
```

每个trace记录的样式：
```json
{
  "ts": "2026-04-10T08:23:11.432+00:00",
  "method": "agentic_loop_stream",
  "provider": "openai",
  "model": "gpt-4o",
  "available_tools": [
    "update_project",
    "clarify_requirement",
    "search_talent_pool",
    "trigger_evaluation",
    "request_industry_research",
    "update_preference"
  ],
  "messages": [
    {"role": "system", "content": "你是一个猎头助理… (截断至400字)"},
    {"role": "user", "content": "帮我找3个有Python经验的后端工程师"}
  ],
  "output": "好的，我来为您搜索…",
  "actions": [
    "search_talent_pool: {\"query\": \"Python 后端工程师\", \"limit\": 10}",
    "trigger_evaluation: {\"candidate_ids\": [1, 2, 3]}"
  ],
  "duration_ms": 3421
}

```
