import { type LiveSource, type Space, type SpaceColor, type SpaceId } from './types'

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
  | { type: 'listSpaces'; windowId?: number }
  | { type: 'getActiveSpace'; windowId: number }
  | { type: 'switchTo'; spaceId: SpaceId; windowId?: number }
  | { type: 'deleteSpace'; spaceId: SpaceId; closeTabs: boolean }
  | { type: 'renameSpace'; spaceId: SpaceId; name: string }
  | { type: 'setSpaceColor'; spaceId: SpaceId; color: SpaceColor }
  | { type: 'getGitHubToken' }
  | { type: 'setGitHubToken'; token?: string }
  | { type: 'reorderSpaces'; windowId: number; orderedIds: SpaceId[] }
  | { type: 'setSpaceEmoji'; spaceId: SpaceId; emoji?: string }
  | {
      type: 'updateLiveSpace'
      spaceId: SpaceId
      source?: LiveSource
      refreshIntervalMin?: number
    }

export interface MessageResponseMap {
  createStatic: Space
  createLive: Space
  syncLive: void
  listSpaces: Space[]
  getActiveSpace: Space | undefined
  switchTo: void
  deleteSpace: void
  renameSpace: void
  setSpaceColor: void
  getGitHubToken: { hasToken: boolean }
  setGitHubToken: void
  reorderSpaces: void
  setSpaceEmoji: void
  updateLiveSpace: Space | undefined
}

export type MessageResponse =
  | { ok: true; data: unknown }
  | { ok: false; error: string }

export async function sendMessage<M extends Message>(
  msg: M,
): Promise<MessageResponseMap[M['type']]> {
  const response = (await chrome.runtime.sendMessage(msg)) as MessageResponse | undefined
  if (!response) throw new Error('No response from background')
  if (!response.ok) throw new Error(response.error)
  return response.data as MessageResponseMap[M['type']]
}
