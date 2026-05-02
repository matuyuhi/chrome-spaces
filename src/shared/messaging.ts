import { type LiveSource, type SpaceColor, type SpaceId } from './types'

export interface CreateStaticPayload {
  name: string
  color: SpaceColor
  emoji?: string
  windowId: number
}

export interface CreateLivePayload {
  name: string
  color: SpaceColor
  emoji?: string
  windowId: number
  source: LiveSource
  refreshIntervalMin?: number
}

export type Message =
  | { type: 'createStatic'; payload: CreateStaticPayload }
  | { type: 'createLive'; payload: CreateLivePayload }
  | { type: 'syncLive'; spaceId: SpaceId }

export type MessageResponse =
  | { ok: true; data: unknown }
  | { ok: false; error: string }

export async function sendMessage<T = unknown>(msg: Message): Promise<T> {
  const response = (await chrome.runtime.sendMessage(msg)) as MessageResponse | undefined
  if (!response) throw new Error('No response from background')
  if (!response.ok) throw new Error(response.error)
  return response.data as T
}
