import styled from '@emotion/styled'
import { createRoot } from 'react-dom/client'
import { GlobalStyles } from '../sidepanel/globalStyles'
import { SettingsPanel } from '../sidepanel/organisms/SettingsPanel'
import { tokens } from '../sidepanel/theme'

// Standalone options-page shell. Reuses the existing SettingsPanel
// component (which already self-contains its bg messaging and store
// reads) but wraps it in a tab-friendly container with breathing room
// instead of the cramped side-panel layout. The component's "← Back"
// closes the tab.
const Shell = styled.div`
  min-height: 100vh;
  background: ${tokens.bg};
  color: ${tokens.fg};
  padding: 24px 16px;
`

const Container = styled.div`
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
`

function OptionsApp() {
  return (
    <>
      <GlobalStyles />
      <Shell>
        <Container>
          <SettingsPanel onClose={() => window.close()} />
        </Container>
      </Shell>
    </>
  )
}

createRoot(document.getElementById('root')!).render(<OptionsApp />)
