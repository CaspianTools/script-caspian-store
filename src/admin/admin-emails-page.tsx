'use client';

import { useEffect, useMemo, useState } from 'react';
import type { EmailSettings, EmailTemplate, EmailTemplateKey } from '../types';
import {
  DEFAULT_EMAIL_SETTINGS,
  EMAIL_TEMPLATE_AUDIENCE,
  EMAIL_TEMPLATE_LABELS,
  getEmailSettings,
  listEmailTemplates,
  saveEmailSettings,
  saveEmailTemplate,
  sendTestEmail,
} from '../services/email-service';
import { reportServiceError } from '../services/error-log-service';
import { useCaspianFirebase } from '../provider/caspian-store-provider';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';
import { Input, Label, Textarea } from '../ui/input';
import { Badge, Skeleton } from '../ui/misc';
import { Table, TBody, TD, TH, THead, TR } from '../ui/table';
import { useToast } from '../ui/toast';
import { FieldDescription } from '../ui/field-description';
import { FieldHelp } from '../ui/field-help';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

export interface AdminEmailsPageProps {
  className?: string;
}

interface TemplateDraft {
  key: EmailTemplateKey;
  enabled: boolean;
  subject: string;
  heading: string;
  additionalContent: string;
  /** Comma-separated for the admin UI; parsed on save. */
  recipientsInput: string;
}

function templateToDraft(t: EmailTemplate): TemplateDraft {
  return {
    key: t.key,
    enabled: t.enabled,
    subject: t.subject,
    heading: t.heading,
    additionalContent: t.additionalContent,
    recipientsInput: t.recipients.join(', '),
  };
}

const PLACEHOLDER_HINTS = [
  { key: '{site_title}', hint: "Your store's brand name" },
  { key: '{order_number}', hint: 'Order id' },
  { key: '{order_total}', hint: 'Formatted total' },
  { key: '{order_date}', hint: "Order's created date" },
  { key: '{customer_name}', hint: "Shopper's display name" },
  { key: '{customer_email}', hint: "Shopper's email" },
];

export function AdminEmailsPage({ className }: AdminEmailsPageProps) {
  const { db, functions } = useCaspianFirebase();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<EmailTemplate[] | null>(null);
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [editingKey, setEditingKey] = useState<EmailTemplateKey | null>(null);
  const [draft, setDraft] = useState<TemplateDraft | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');

  const loadAll = async () => {
    try {
      const [list, s] = await Promise.all([listEmailTemplates(db), getEmailSettings(db)]);
      setTemplates(list);
      setSettings(s ?? { ...DEFAULT_EMAIL_SETTINGS, updatedAt: null as never });
      setSettingsDirty(false);
    } catch (error) {
      reportServiceError(db, 'admin-emails-page.load', error);
      toast({ title: 'Failed to load email config', variant: 'destructive' });
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patchSettings = (p: Partial<EmailSettings>) => {
    setSettings((prev) => (prev ? { ...prev, ...p } : prev));
    setSettingsDirty(true);
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    if (!settings.fromAddress.trim()) {
      toast({ title: 'From address is required', variant: 'destructive' });
      return;
    }
    setSavingSettings(true);
    try {
      await saveEmailSettings(db, settings);
      toast({ title: 'Email settings saved' });
      setSettingsDirty(false);
    } catch (error) {
      reportServiceError(db, 'admin-emails-page.saveSettings', error);
      toast({ title: 'Save failed', variant: 'destructive' });
    } finally {
      setSavingSettings(false);
    }
  };

  const openTemplate = (template: EmailTemplate) => {
    setEditingKey(template.key);
    setDraft(templateToDraft(template));
    setTestRecipient('');
  };

  const closeTemplate = () => {
    setEditingKey(null);
    setDraft(null);
  };

  const handleSaveTemplate = async () => {
    if (!draft) return;
    if (!draft.subject.trim() || !draft.heading.trim()) {
      toast({ title: 'Subject and heading are required', variant: 'destructive' });
      return;
    }
    setSavingTemplate(true);
    try {
      await saveEmailTemplate(db, {
        key: draft.key,
        enabled: draft.enabled,
        subject: draft.subject,
        heading: draft.heading,
        additionalContent: draft.additionalContent,
        recipients: draft.recipientsInput
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
      });
      toast({ title: 'Template saved' });
      await loadAll();
      closeTemplate();
    } catch (error) {
      reportServiceError(db, 'admin-emails-page.saveTemplate', error);
      toast({ title: 'Save failed', variant: 'destructive' });
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleSendTest = async () => {
    if (!draft || !testRecipient.trim()) {
      toast({ title: 'Enter an email address first', variant: 'destructive' });
      return;
    }
    setSendingTest(true);
    try {
      const result = await sendTestEmail(functions, {
        key: draft.key,
        to: testRecipient.trim(),
      });
      if (result.ok) {
        toast({ title: 'Test email sent', description: testRecipient });
      } else {
        toast({
          title: 'Test send failed',
          description: result.error,
          variant: 'destructive',
        });
      }
    } catch (error) {
      reportServiceError(db, 'admin-emails-page.sendTest', error);
      toast({
        title: 'Test send failed',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setSendingTest(false);
    }
  };

  const audienceBadge = (key: EmailTemplateKey) => {
    const audience = EMAIL_TEMPLATE_AUDIENCE[key];
    return (
      <Badge variant={audience === 'admin' ? 'destructive' : 'secondary'}>
        {audience === 'admin' ? 'Admin' : 'Customer'}
      </Badge>
    );
  };

  const preview = useMemo(() => {
    if (!draft || !settings) return null;
    const sample = {
      '{site_title}': settings.fromName || 'Your store',
      '{order_number}': 'H1700000000000',
      '{order_total}': '$123.45',
      '{order_date}': new Date().toLocaleDateString(),
      '{customer_name}': 'Alex Shopper',
      '{customer_email}': 'alex@example.com',
    };
    const render = (s: string) =>
      Object.entries(sample).reduce(
        (acc, [token, value]) => acc.split(token).join(value),
        s,
      );
    return {
      subject: render(draft.subject),
      heading: render(draft.heading),
      body: render(draft.additionalContent),
    };
  }, [draft, settings]);

  if (!templates || !settings) {
    return (
      <div className={className}>
        <Skeleton style={{ height: 240 }} />
      </div>
    );
  }

  return (
    <div className={className}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Emails</h1>
        <p style={{ color: '#666', marginTop: 4 }}>
          Transactional emails sent by the Cloud Function when orders are created or updated.
          Template content is merchant-editable; the HTML shell comes from the global sender settings.
        </p>
      </header>

      <Tabs defaultValue="sender">
        <TabsList>
          <TabsTrigger value="sender">Sender</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="sender">
          <div style={{ maxWidth: 720 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, marginBottom: 12 }}>
          Global sender settings
          <FieldHelp>
            Used to render every email. The Cloud Function (<code>runEmailOnOrderWrite</code>)
            reads these values once per send.
          </FieldHelp>
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => patchSettings({ enabled: e.target.checked })}
            />
            <span>Master enabled switch</span>
          </label>
          <FieldDescription style={{ marginTop: -4 }}>
            When off, the Cloud Function logs and exits without sending — useful during
            development to prevent accidental sends.
          </FieldDescription>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <Label>From name</Label>
              <Input
                value={settings.fromName}
                placeholder="Acme Store"
                onChange={(e) => patchSettings({ fromName: e.target.value })}
              />
            </div>
            <div>
              <Label>From address</Label>
              <Input
                type="email"
                value={settings.fromAddress}
                placeholder="store@example.com"
                onChange={(e) => patchSettings({ fromAddress: e.target.value })}
              />
              <FieldDescription>
                Must be a verified sender with your email provider.
              </FieldDescription>
            </div>
          </div>

          <div>
            <Label>Reply-to (optional)</Label>
            <Input
              type="email"
              value={settings.replyTo ?? ''}
              placeholder="support@example.com"
              onChange={(e) => patchSettings({ replyTo: e.target.value })}
            />
          </div>

          <div>
            <Label>Logo URL (optional)</Label>
            <Input
              value={settings.logoUrl ?? ''}
              placeholder="https://cdn.example.com/logo.png"
              onChange={(e) => patchSettings({ logoUrl: e.target.value })}
            />
            <FieldDescription>
              Shown at the top of every email. Falls back to the site logo when blank.
            </FieldDescription>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <Label>Accent color</Label>
              <Input
                value={settings.accentColor}
                onChange={(e) => patchSettings({ accentColor: e.target.value })}
              />
            </div>
            <div>
              <Label>Background color</Label>
              <Input
                value={settings.backgroundColor}
                onChange={(e) => patchSettings({ backgroundColor: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label>Footer text</Label>
            <Textarea
              rows={3}
              value={settings.footerText}
              placeholder="Acme Store · 123 High Street, London · Unsubscribe in your account."
              onChange={(e) => patchSettings({ footerText: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              size="sm"
              onClick={handleSaveSettings}
              loading={savingSettings}
              disabled={!settingsDirty}
            >
              Save sender settings
            </Button>
          </div>
        </div>
          </div>
        </TabsContent>

        <TabsContent value="templates">
      <Table>
        <THead>
          <TR>
            <TH>Template</TH>
            <TH>Audience</TH>
            <TH>Subject</TH>
            <TH>Status</TH>
            <TH style={{ textAlign: 'right' }}>Actions</TH>
          </TR>
        </THead>
        <TBody>
          {templates.map((tpl) => (
            <TR key={tpl.key}>
              <TD style={{ fontWeight: 500 }}>{EMAIL_TEMPLATE_LABELS[tpl.key]}</TD>
              <TD>{audienceBadge(tpl.key)}</TD>
              <TD style={{ color: '#555', fontSize: 13, maxWidth: 320 }}>
                <span
                  style={{
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tpl.subject}
                </span>
              </TD>
              <TD>
                <Badge variant={tpl.enabled ? 'default' : 'secondary'}>
                  {tpl.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </TD>
              <TD style={{ textAlign: 'right' }}>
                <Button variant="outline" size="sm" onClick={() => openTemplate(tpl)}>
                  Edit
                </Button>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
        </TabsContent>
      </Tabs>

      {draft && (
        <Dialog
          open={editingKey !== null}
          onOpenChange={(open) => {
            if (!open) closeTemplate();
          }}
          title={EMAIL_TEMPLATE_LABELS[draft.key]}
          description="Edit the subject, heading, and body. Preview updates live below."
          maxWidth={720}
          footer={
            <>
              <Button variant="outline" onClick={closeTemplate} disabled={savingTemplate}>
                Cancel
              </Button>
              <Button onClick={handleSaveTemplate} loading={savingTemplate}>
                Save template
              </Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(e) =>
                  setDraft((d) => (d ? { ...d, enabled: e.target.checked } : d))
                }
              />
              <span>Enabled — the Cloud Function sends this email when the trigger fires</span>
            </label>

            {EMAIL_TEMPLATE_AUDIENCE[draft.key] === 'admin' && (
              <div>
                <Label>Admin recipients (comma-separated)</Label>
                <Input
                  value={draft.recipientsInput}
                  placeholder="ops@example.com, warehouse@example.com"
                  onChange={(e) =>
                    setDraft((d) => (d ? { ...d, recipientsInput: e.target.value } : d))
                  }
                />
                <FieldDescription>
                  Leave blank to fall back to the store's contact email.
                </FieldDescription>
              </div>
            )}

            <div>
              <Label>Subject</Label>
              <Input
                value={draft.subject}
                onChange={(e) => setDraft((d) => (d ? { ...d, subject: e.target.value } : d))}
              />
            </div>
            <div>
              <Label>Heading</Label>
              <Input
                value={draft.heading}
                onChange={(e) => setDraft((d) => (d ? { ...d, heading: e.target.value } : d))}
              />
            </div>
            <div>
              <Label>Additional content</Label>
              <Textarea
                rows={5}
                value={draft.additionalContent}
                onChange={(e) =>
                  setDraft((d) => (d ? { ...d, additionalContent: e.target.value } : d))
                }
              />
              <FieldDescription>
                Placeholders supported:{' '}
                {PLACEHOLDER_HINTS.map((p, i) => (
                  <span key={p.key}>
                    <code>{p.key}</code>
                    {i < PLACEHOLDER_HINTS.length - 1 ? ', ' : ''}
                  </span>
                ))}
              </FieldDescription>
            </div>

            {preview && (
              <div
                style={{
                  border: '1px solid #eee',
                  borderRadius: 'var(--caspian-radius, 8px)',
                  padding: 14,
                  background: '#fafafa',
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: '#888',
                  }}
                >
                  Preview (sample data)
                </p>
                <p style={{ margin: '8px 0 4px', fontSize: 13, color: '#666' }}>
                  Subject: <strong style={{ color: '#111' }}>{preview.subject}</strong>
                </p>
                <h3 style={{ margin: '8px 0 4px', fontSize: 18 }}>{preview.heading}</h3>
                <p style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#333' }}>{preview.body}</p>
              </div>
            )}

            <div
              style={{
                borderTop: '1px solid #eee',
                paddingTop: 12,
                display: 'flex',
                alignItems: 'flex-end',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ flex: 1, minWidth: 240 }}>
                <Label>Send test to</Label>
                <Input
                  type="email"
                  value={testRecipient}
                  placeholder="you@example.com"
                  onChange={(e) => setTestRecipient(e.target.value)}
                />
                <FieldDescription>
                  Calls the <code>sendTestEmail</code> Cloud Function. Requires
                  <code>SENDGRID_API_KEY</code> secret (or your configured provider key).
                </FieldDescription>
              </div>
              <Button variant="outline" onClick={handleSendTest} loading={sendingTest}>
                Send test
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
