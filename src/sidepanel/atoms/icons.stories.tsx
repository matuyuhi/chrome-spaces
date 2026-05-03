import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Download,
  Minus,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Settings,
  X,
} from './icons'

const meta: Meta = {
  title: 'atoms/icons',
}
export default meta

type Story = StoryObj

const Item = ({ name, children }: { name: string; children: React.ReactNode }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6,
      width: 72,
      padding: 8,
      borderRadius: 6,
      background: 'var(--bg-soft)',
    }}
  >
    {children}
    <span style={{ fontSize: 11, color: 'var(--muted)' }}>{name}</span>
  </div>
)

export const All: Story = {
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <Item name="ChevronRight"><ChevronRight /></Item>
      <Item name="ChevronDown"><ChevronDown /></Item>
      <Item name="MoreHorizontal"><MoreHorizontal /></Item>
      <Item name="RefreshCw"><RefreshCw /></Item>
      <Item name="X"><X /></Item>
      <Item name="Minus"><Minus /></Item>
      <Item name="Plus"><Plus /></Item>
      <Item name="Settings"><Settings /></Item>
      <Item name="Download"><Download /></Item>
      <Item name="AlertTriangle"><AlertTriangle /></Item>
    </div>
  ),
}
