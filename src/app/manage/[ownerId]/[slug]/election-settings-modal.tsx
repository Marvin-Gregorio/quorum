'use client';

import { useState } from 'react';
import { updateElectionSettingsAction } from './actions';
import { cn } from '@/lib/cn';
import {
  MODAL_OVERLAY,
  MODAL_PANEL,
  MODAL_PANEL_WIDE,
  FIELD_LABEL,
  TEXT_INPUT,
  RADIO_OPTION,
  RADIO_CHOICE_CLASS,
  CHIP,
  CHIP_REMOVE_BTN,
  PRIMARY_BTN,
  SECONDARY_BTN,
} from '@/lib/ui-classes';

export interface ElectionSettings {
  organizationName: string;
  title: string;
  votingStartsAt: string;
  votingEndsAt: string;
  isPrivate: boolean;
  domains: string[];
}

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ElectionSettingsModal({
  pageId,
  initial,
  onClose,
  onSaved,
}: {
  pageId: string;
  initial: ElectionSettings;
  onClose: () => void;
  onSaved: (settings: ElectionSettings) => void;
}) {
  const [orgName, setOrgName] = useState(initial.organizationName);
  const [title, setTitle] = useState(initial.title);
  const [opens, setOpens] = useState(toDatetimeLocal(initial.votingStartsAt));
  const [closes, setCloses] = useState(toDatetimeLocal(initial.votingEndsAt));
  const [isPrivate, setIsPrivate] = useState(initial.isPrivate);
  const [domains, setDomains] = useState(initial.domains);
  const [domainInput, setDomainInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addDomain() {
    const value = domainInput.trim().toLowerCase();
    if (!value || domains.includes(value)) return;
    setDomains([...domains, value]);
    setDomainInput('');
  }

  function removeDomain(domain: string) {
    setDomains(domains.filter((d) => d !== domain));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const votingStartsAt = new Date(opens).toISOString();
      const votingEndsAt = new Date(closes).toISOString();
      const result = await updateElectionSettingsAction(pageId, {
        organizationName: orgName,
        title,
        votingStartsAt,
        votingEndsAt,
        isPrivate,
        domains,
      });
      if ('error' in result) {
        setError(result.error);
        return;
      }
      onSaved({ organizationName: orgName, title, votingStartsAt, votingEndsAt, isPrivate, domains });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={MODAL_OVERLAY}>
      <div role="dialog" aria-label="Election settings" className={cn(MODAL_PANEL, MODAL_PANEL_WIDE)}>
        <h2 className="text-xl mb-6">Election settings</h2>
        {error && (
          <p role="alert" className="text-seal-dark text-sm mb-4">
            {error}
          </p>
        )}
        <div className="mb-5">
          <label className={FIELD_LABEL} htmlFor="sm-org">
            Organization name
          </label>
          <input
            className={TEXT_INPUT}
            id="sm-org"
            type="text"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
          />
        </div>
        <div className="mb-5">
          <label className={FIELD_LABEL} htmlFor="sm-title">
            Election title
          </label>
          <input
            className={TEXT_INPUT}
            id="sm-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="flex gap-4 flex-wrap mb-6">
          <div className="flex-[1_1_200px]">
            <label className={FIELD_LABEL} htmlFor="sm-opens">
              Opens
            </label>
            <input
              className={TEXT_INPUT}
              id="sm-opens"
              type="datetime-local"
              value={opens}
              onChange={(e) => setOpens(e.target.value)}
            />
          </div>
          <div className="flex-[1_1_200px]">
            <label className={FIELD_LABEL} htmlFor="sm-closes">
              Closes
            </label>
            <input
              className={TEXT_INPUT}
              id="sm-closes"
              type="datetime-local"
              value={closes}
              onChange={(e) => setCloses(e.target.value)}
            />
          </div>
        </div>

        <fieldset className="mb-3">
          <legend>Who can vote</legend>
          <label className={RADIO_OPTION}>
            <input
              type="radio"
              name="sm-visibility"
              className={RADIO_CHOICE_CLASS}
              checked={!isPrivate}
              onChange={() => setIsPrivate(false)}
            />
            <span>Anyone with a Google or Microsoft account</span>
          </label>
          <label className={RADIO_OPTION}>
            <input
              type="radio"
              name="sm-visibility"
              className={RADIO_CHOICE_CLASS}
              checked={isPrivate}
              onChange={() => setIsPrivate(true)}
            />
            <span>Only people with a specific email domain</span>
          </label>
        </fieldset>

        {isPrivate && (
          <div className="mb-7 pl-7">
            <div className="flex gap-2 flex-wrap items-center mb-3">
              {domains.map((domain) => (
                <span className={CHIP} key={domain}>
                  {domain}
                  <button type="button" className={CHIP_REMOVE_BTN} onClick={() => removeDomain(domain)} aria-label={`Remove ${domain}`}>
                    &times;
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className={TEXT_INPUT}
                type="text"
                placeholder="Add a domain, e.g. riverside.coop"
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addDomain();
                  }
                }}
              />
              <button
                type="button"
                onClick={addDomain}
                className="border border-ink bg-transparent rounded-[3px] px-[18px] py-0 text-sm cursor-pointer whitespace-nowrap"
              >
                Add
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" className={SECONDARY_BTN} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={PRIMARY_BTN} onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
