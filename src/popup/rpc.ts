import { sendMessage } from '../shared/messaging'
import { type SpaceColor, type SpaceId } from '../shared/types'

export const listSpaces = (windowId?: number) =>
  sendMessage({ type: 'listSpaces', windowId })

export const getActiveSpace = (windowId: number) =>
  sendMessage({ type: 'getActiveSpace', windowId })

export const switchTo = (spaceId: SpaceId, windowId?: number) =>
  sendMessage({ type: 'switchTo', spaceId, windowId })

export const deleteSpace = (spaceId: SpaceId, closeTabs: boolean) =>
  sendMessage({ type: 'deleteSpace', spaceId, closeTabs })

export const renameSpace = (spaceId: SpaceId, name: string) =>
  sendMessage({ type: 'renameSpace', spaceId, name })

export const setSpaceColor = (spaceId: SpaceId, color: SpaceColor) =>
  sendMessage({ type: 'setSpaceColor', spaceId, color })

export const getGitHubTokenStatus = () => sendMessage({ type: 'getGitHubToken' })

export const setGitHubToken = (token: string | undefined) =>
  sendMessage({ type: 'setGitHubToken', token })

export const reorderSpaces = (windowId: number, orderedIds: SpaceId[]) =>
  sendMessage({ type: 'reorderSpaces', windowId, orderedIds })
