import styled from '@emotion/styled'
import { tokens } from '../theme'
import { LinkButton } from '../atoms/Button'

const Box = styled.div`
  font-size: 11px;
  color: ${tokens.danger};
  background: rgba(207, 34, 46, 0.08);
  border-radius: ${tokens.radius.md};
  padding: 8px 10px;
  word-break: break-word;
  display: flex;
  justify-content: space-between;
  gap: 8px;
`

export function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string
  onDismiss: () => void
}) {
  return (
    <Box role="alert">
      {message}
      <LinkButton onClick={onDismiss}>dismiss</LinkButton>
    </Box>
  )
}
