// 表情列表
export interface Emoji {
  id: string
  name: string
  symbol: string
}

export const EMOJIS: Emoji[] = [
  { id: 'laugh', name: '哈哈', symbol: '😄' },
  { id: 'angry', name: '生气', symbol: '😠' },
  { id: 'cry', name: '哭', symbol: '😢' },
  { id: 'think', name: '思考', symbol: '🤔' },
  { id: 'cool', name: '酷', symbol: '😎' },
  { id: 'surprise', name: '惊讶', symbol: '😲' },
  { id: 'sweat', name: '流汗', symbol: '😅' },
  { id: 'love', name: '喜欢', symbol: '😍' },
]

// 快捷消息列表
export interface QuickMessage {
  id: string
  text: string
}

export const QUICK_MESSAGES: QuickMessage[] = [
  { id: 'hurry', text: '快点啊，等得花儿都谢了！' },
  { id: 'nice', text: '打得真好！' },
  { id: 'bomb', text: '炸弹炸死你！' },
  { id: 'sorry', text: '不好意思，我断线了' },
  { id: 'lucky', text: '运气真好！' },
  { id: 'gg', text: 'GG，下次再来！' },
  { id: 'again', text: '再来一局？' },
  { id: 'thanks', text: '谢谢配合！' },
]

// 根据ID获取表情
export function getEmojiById(id: string): Emoji | undefined {
  return EMOJIS.find(e => e.id === id)
}

// 根据ID获取快捷消息
export function getQuickMessageById(id: string): QuickMessage | undefined {
  return QUICK_MESSAGES.find(m => m.id === id)
}
