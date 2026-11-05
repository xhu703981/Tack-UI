import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { SettingsRow, Toggle } from '../../components/ui'
import { PageHeader } from './Personal'
import { useStore } from '../../data/store'
import type { Integration } from '../../data/types'
import { connectGithub, disconnectGithub, getGithub, githubInstallUrl, type ApiGithubStatus } from '../../data/api'

/** The workspace's real GitHub connection (the other integrations are still mock). Also keeps the card's badge right. */
function useGithub(active = true) {
  const { setDb, toast } = useStore()
  const [status, setStatus] = useState<ApiGithubStatus | null>(null)
  const load = () =>
    getGithub()
      .then((s) => {
        setStatus(s)
        setDb((d) => ({ ...d, integrations: d.integrations.map((x) => (x.id === 'github' ? { ...x, enabled: s.connected } : x)) }))
      })
      .catch((e: Error) => toast(e.message))
  useEffect(() => {
    if (active) load()
  }, [active])
  return { status, load }
}

function Logo({ i, size = 32 }: { i: Integration; size?: number }) {
  return (
    <span className="logo" style={{ background: i.color, width: size, height: size, fontSize: size * 0.4 }}>
      {i.name[0]}
    </span>
  )
}

export function Integrations() {
  const { db } = useStore()
  useGithub()
  return (
    <div className="settings-page" style={{ maxWidth: 920 }}>
      <PageHeader title="Integrations" desc="Connect the workspace to the tools your team already uses." />
      <div className="integration-grid">
        {db.integrations.map((i) => (
          <Link key={i.id} to={`/settings/integrations/${i.id}`} className="card integration-card">
            <div className="row">
              <Logo i={i} />
              <span className="spacer" />
              {i.enabled ? <span className="badge-pill green">Enabled</span> : <span className="btn sm">Add</span>}
            </div>
            <div style={{ fontWeight: 600 }}>{i.name}</div>
            <div className="muted">{i.description}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}

// Per-integration configuration options shown on the detail page (local UI state only).
const OPTIONS: Record<string, { title: string; desc: string }[]> = {
  github: [
    { title: 'Link pull requests automatically', desc: 'Attach PRs whose branch name contains an issue ID.' },
    { title: 'Move issue to In Review when PR opens', desc: 'Update status as the pull request progresses.' },
    { title: 'Close issue when PR merges', desc: 'Mark linked issues as Done on merge.' },
  ],
  slack: [
    { title: 'Post new issues to a channel', desc: 'Send a message for each issue created in your projects.' },
    { title: 'Create issues from messages', desc: 'Use the message shortcut to turn a Slack thread into an issue.' },
  ],
  figma: [{ title: 'Show live previews', desc: 'Render Figma links as live embeds in issues.' }],
  gdrive: [{ title: 'Show file previews', desc: 'Render Docs, Sheets and Slides links as previews.' }],
  zapier: [{ title: 'Allow Zaps to create issues', desc: 'Let Zapier workflows create and update issues.' }],
}

export function IntegrationDetail() {
  const { integrationId } = useParams()
  const { db, setDb, toast, isAdmin } = useStore()
  const i = db.integrations.find((x) => x.id === integrationId)
  const [opts, setOpts] = useState<Record<string, boolean>>({})
  const isGithub = integrationId === 'github'
  const github = useGithub(isGithub)
  if (!i) return <div className="empty-state">Integration not found.</div>
  const setEnabled = (enabled: boolean) => {
    if (isGithub) {
      // Connecting leaves Tack: GitHub's install page, then back to /settings/integrations/github/callback.
      if (enabled) githubInstallUrl().then(({ url }) => window.location.assign(url)).catch((e: Error) => toast(e.message))
      else
        disconnectGithub()
          .then(() => github.load())
          .then(() => toast('GitHub disconnected'))
          .catch((e: Error) => toast(e.message))
      return
    }
    setDb((d) => ({ ...d, integrations: d.integrations.map((x) => (x.id === i.id ? { ...x, enabled } : x)) }))
    toast(enabled ? `${i.name} connected` : `${i.name} disconnected`)
  }
  // Only Admins can connect or disconnect GitHub (the backend checks too).
  const locked = isGithub && !isAdmin

  return (
    <div className="settings-page">
      <Link to="/settings/integrations" className="row muted" style={{ gap: 4, marginBottom: 16 }}>
        <ChevronLeft size={14} /> Integrations
      </Link>
      <div className="row" style={{ gap: 12, marginBottom: 32 }}>
        <Logo i={i} size={48} />
        <div style={{ flex: 1 }}>
          <h1 className="title-lg">{i.name}</h1>
          <p className="muted" style={{ margin: 0 }}>{i.description}</p>
        </div>
        {i.enabled ? (
          <button className="btn danger-outline" disabled={locked} onClick={() => setEnabled(false)}>Disconnect</button>
        ) : (
          <button className="btn primary" disabled={locked} onClick={() => setEnabled(true)}>Connect {i.name}</button>
        )}
      </div>
      {locked && <p className="faint" style={{ marginTop: -24, marginBottom: 24 }}>Only workspace Admins can change this.</p>}
      {isGithub && github.status?.connected && (
        <section className="settings-section" style={{ marginTop: 0 }}>
          <h3>Connected to {github.status.account}</h3>
          <div className="card" style={{ padding: '0 16px' }}>
            {github.status.repositories.map((r) => (
              <SettingsRow key={r} title={r} desc="Pull requests in this repository reach Tack." />
            ))}
          </div>
          <p className="faint" style={{ marginTop: 8 }}>Add or remove repositories in the app's settings on GitHub.</p>
        </section>
      )}
      <section className="settings-section" style={{ opacity: i.enabled ? 1 : 0.5, pointerEvents: i.enabled ? undefined : 'none' }}>
        <h3>Configuration</h3>
        <div className="card" style={{ padding: '0 16px' }}>
          {(OPTIONS[i.id] ?? []).map((o, n) => (
            <SettingsRow key={o.title} title={o.title} desc={o.desc}>
              <Toggle on={opts[o.title] ?? n === 0} label={o.title} onChange={(v) => setOpts({ ...opts, [o.title]: v })} />
            </SettingsRow>
          ))}
        </div>
        {!i.enabled && <p className="faint" style={{ marginTop: 8 }}>Connect {i.name} to configure it.</p>}
      </section>
    </div>
  )
}

/** GitHub's "Setup URL": after installing, GitHub sends the browser here with ?installation_id=…&state=…. */
export function GithubCallback() {
  const navigate = useNavigate()
  const { toast } = useStore()
  const [params] = useSearchParams()
  const [error, setError] = useState('')
  const sent = useRef(false) // StrictMode runs effects twice in development; connect once

  useEffect(() => {
    if (sent.current) return
    sent.current = true
    const id = params.get('installation_id')
    const state = params.get('state')
    const back = () => navigate('/settings/integrations/github', { replace: true })
    // Repos changed from GitHub's own settings page: no state, nothing to connect. The detail page asks GitHub live.
    if (params.get('setup_action') === 'update' && !state) return back()
    // In an organization, a non-owner can only request the install; an owner has to approve it on GitHub.
    if (params.get('setup_action') === 'request') return setError('Install requested: an owner of the GitHub organization has to approve it.')
    if (!id || !state) return setError('GitHub sent no installation back. Try connecting again.')
    connectGithub(Number(id), state)
      .then(() => {
        toast('GitHub connected')
        back()
      })
      .catch((e: Error) => setError(e.message))
  }, [])

  return (
    <div className="settings-page">
      {error ? (
        <>
          <p className="danger-text">{error}</p>
          <Link to="/settings/integrations/github">Back to GitHub</Link>
        </>
      ) : (
        <p className="muted">Connecting GitHub…</p>
      )}
    </div>
  )
}
