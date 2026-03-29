# Requirement Spec Creator

Creates a new requirement spec file from user input and saves it to `docs/specs/`.

## How to use

When the user says they want to add a feature or change, run this command by starting a conversation with:

> "我要加一个新需求：[描述你的需求]"

## Steps

### Step 1: Gather requirements

Ask the user ONE question at a time to fill in the template:

**Q1 - 功能名称**
> "这个功能叫什么名字？"

**Q2 - 背景**
> "为什么需要这个功能？不做会怎样？"

**Q3 - 包含什么**
> "这个功能具体要做哪些事？" (multiple choice preferred)

**Q4 - 不包含什么** (optional)
> "这次不做哪些？有没有需要排除的？"

**Q5 - 验收标准**
> "怎么算完成？用户能看到什么结果？" (ask for each AC)

### Step 2: Build the spec

Write the spec file to `docs/specs/YYYY-MM-DD-<feature-name>.md`:

```markdown
# [Feature Name]

## 背景
[One sentence]

## 范围
### 包含
- [Bullet points]

### 不包含
- [Bullet points]

## 验收标准
- [ ] AC-01: [Observable result]
- [ ] AC-02: [Observable result]
- [ ] AC-03: `pnpm test` passes

## 技术备注
[Optional constraints or notes]
```

Use today's date: `2026-03-30`.

### Step 3: Confirm with user

Show the user the file path and ask:
> "需求文档已创建：`docs/specs/YYYY-MM-DD-<feature-name>.md`。
> 内容如下：
> [paste content]
> 确认后我开始执行。"

### Step 4: After confirmation

1. Read the spec
2. Use `superpowers:writing-plans` skill to create implementation plan
3. Execute with `superpowers:subagent-driven-development`

## Rules
- Ask ONE question at a time
- If user gives vague answer, ask for specifics
- AC must be "observable result" — not implementation details
- Last AC must always be: `- [ ] AC-XX: \`pnpm test\` passes`
- Save to `docs/specs/` directory
