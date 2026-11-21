import { randomUUID } from 'node:crypto'

export const name = 'dsh-progress-fold'
export const inject = ['systemPrompt']

const instructions = '执行长任务时，查到关键结果、完成一个阶段或遇到阻塞后，用一两句用户可见的正文说明当前进展。'
  + '连续的小操作可以合并汇报，简单任务可以直接回答。'

const reminder = '继续执行前，请用一两句正文向用户汇报刚完成的工作、关键发现或当前阻塞。'

function wasSilentToolStep(session, turn, step) {
  const nodes = session.surface.nodes
  for (let index = nodes.length - 1; index >= 0; index--) {
    const event = session.eventAt(nodes[index])
    if (event?.type !== 'assistant/message') continue

    const { message, turn: messageTurn, step: messageStep } = event.data
    if (messageTurn !== turn || messageStep !== step) return false
    return message.content.some(block => block.type === 'tool-call')
      && !message.content.some(block => block.type === 'text' && block.text.trim())
  }
  return false
}

export function apply(ctx, { enforce = true, everySteps = 5 } = {}) {
  ctx.effect(() => ctx.systemPrompt.section({ name, order: 10150, text: instructions }))
  if (!enforce) return

  const runs = new WeakMap()
  ctx.on('agent/pre-step', async ({ agent, turn, step, signal }, next) => {
    const decision = await next()
    if (decision.kind !== 'enter' || signal.aborted || step === 1) return decision

    const { session } = agent
    const previous = runs.get(session)
    if (previous?.turn === turn && previous.step >= step) return decision

    const consecutive = previous?.turn === turn && previous.step === step - 1
    const silentSteps = wasSilentToolStep(session, turn, step - 1)
      ? (consecutive ? previous.silentSteps : 0) + 1
      : 0
    const remind = silentSteps >= everySteps
    runs.set(session, { turn, step, silentSteps: remind ? 0 : silentSteps })
    if (!remind) return decision

    return {
      ...decision,
      messages: [...decision.messages, {
        id: randomUUID(),
        role: 'user',
        content: [{ type: 'text', text: reminder }],
        source: { kind: name, form: 'notice', summary: '进度汇报提醒' },
      }],
    }
  })
}
