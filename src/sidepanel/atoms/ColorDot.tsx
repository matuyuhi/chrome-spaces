import styled from '@emotion/styled'

export const ColorDot = styled.span<{ size?: number; color: string }>`
  width: ${(p) => p.size ?? 10}px;
  height: ${(p) => p.size ?? 10}px;
  border-radius: 50%;
  flex-shrink: 0;
  background: ${(p) => p.color};
  display: inline-block;
`
