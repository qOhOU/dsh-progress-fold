# DSH 进度汇报插件

`dsh-progress-fold` 是一个独立的 DeepSeek Harness（DSH）插件。长任务执行期间，插件引导助手在拿到关键结果、完成阶段性工作或遇到阻塞时输出简短进度。回合成功结束后，配置过的 DSH 原生「对话」页会把中间正文和工作详情收进最终答案上方的「用时」入口，展开后可以回看。

## 安装与配置

克隆仓库后，在根目录用 PowerShell 打包，再把归档安装到 `desktop` profile。启用新插件，停用 Better Display 和 Progress Rules，然后回到原生「对话」页。 [DSH 插件安装说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md)

```powershell
npm pack --pack-destination $env:TEMP
dsh plugin --profile desktop add (Join-Path $env:TEMP 'dsh-progress-fold-0.1.0.tgz')
```

默认连续 5 个静默工具步骤后提醒一次。在当前 profile 的 `cordis.patch.yml` 里覆盖 `dsh-progress-fold` 的配置即可调整阈值。`everySteps` 填正整数。`enforce: false` 关闭步骤提醒，系统提示词仍会引导模型分阶段汇报。

```yaml
- id: dsh-progress-fold
  config:
    everySteps: 5
    enforce: true
```

## 进度如何产生

1. 通过 DSH 的系统提示词服务注册独立段落。要求模型在完成一个有结果的阶段后，用一两句正文交代发现、结论或接下来的动作。短任务可直接回答，连续几次小读取可以合并汇报。
2. 通过 `agent/pre-step` 检查同一回合上一个已完成的模型步骤。一个步骤可以有多次工具调用，只计一次。步骤有工具调用、但没有非空的用户可见正文时计为一次沉默。默认连续满 5 步，在下一次获准进入的模型请求中加入一条简短提醒。
3. 计数按会话和回合隔离，同一个步骤最多计一次。有可见正文或步序不再连续时清零，新回合从零开始。触发提醒后重新计数，取消、拒绝进入或重试同一步时避免重复注入。提醒带插件来源标记，在会话中作为上下文呈现。

模型生成的进度走原生文本流。提醒只在模型步骤之间触发，单次模型调用或工具执行期间的等待状态由 DSH 显示。

## 「对话」页的折叠设置

在 DSH 的「设置 → 常规」选择以下原生选项。首版通过文档引导配置，由用户保留对现有显示偏好的控制。

| 设置 | 推荐值 |
| --- | --- |
| 工作详情 | 详细（Detailed） |
| 收起时机 | 完成时（On completion） |
| 收起后显示的回复 | 仅最终答案（Final answer only） |

正常回合结束后，阶段回复随过程折叠。失败和停止的回合保留整轮过程；待审批时可继续查看当前状态。用户在过程开始后插入消息时，DSH 保留消息与过程的顺序，该轮仍可按组展开和收起。缺少轮次起点的历史记录按原生规则显示，有完整起止时间的回合可以显示用时。 [DSH 原生整轮折叠说明](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.5/packages/client/ui-chat/src/client/conversation-nodes/README.zh.md#整轮折叠)

## 验收

已在 DSH `0.2.2-rc.3` 的隔离 headless profile 中验证归档安装、系统提示词和项目 `AGENTS.md` 的注入，以及第 5 个静默工具步骤后在下一次请求中加入提醒。

1. **验证触发边界。** 用可控事件测试 4 步静默不提醒、第 5 步后提醒一次、出现正文后重新计数、新回合和并行会话互不影响。验证单步骤含多个工具调用、同一步重试、取消和提醒关闭的情况。
2. **验证桌面体验。** 只启用新插件运行短任务和长任务。长任务在最终回答之前出现进度，完成后答案上方有可展开入口，重新打开历史会话仍可回看。检查中断、待审批和执行中追加消息时的显示。
