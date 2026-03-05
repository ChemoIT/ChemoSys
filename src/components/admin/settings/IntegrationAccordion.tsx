'use client'

/**
 * IntegrationAccordion — accordion wrapper managing 5 integration sections.
 *
 * Each section has:
 *   - AccordionTrigger: integration name (Hebrew) + icon + enabled/disabled status badge
 *   - AccordionContent: specific settings component for that integration
 *
 * Order: SMS → WhatsApp → FTP → Telegram → LLM
 */

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { MessageSquare, Phone, HardDrive, Send, Brain, Mail, Car } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { SmsSettings } from './SmsSettings'
import { WhatsAppSettings } from './WhatsAppSettings'
import { FtpSettings } from './FtpSettings'
import { TelegramSettings } from './TelegramSettings'
import { LlmSettings } from './LlmSettings'
import { EmailSettings } from './EmailSettings'
import { FleetSettings } from './FleetSettings'
import type { IntegrationSettings } from '@/actions/settings'

type Props = {
  settings: IntegrationSettings
}

export function IntegrationAccordion({ settings }: Props) {
  return (
    <Accordion type="single" collapsible className="w-full space-y-2">
      {/* 1. SMS Micropay */}
      <AccordionItem value="sms" className="border rounded-lg px-4">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-muted-foreground shrink-0" />
            <span className="font-medium">SMS (Micropay)</span>
            <StatusBadge enabled={settings.sms.enabled} />
          </div>
        </AccordionTrigger>
        <AccordionContent className="pt-2 pb-4">
          <SmsSettings settings={settings.sms} />
        </AccordionContent>
      </AccordionItem>

      {/* 2. WhatsApp */}
      <AccordionItem value="whatsapp" className="border rounded-lg px-4">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-3">
            <Phone className="h-5 w-5 text-muted-foreground shrink-0" />
            <span className="font-medium">WhatsApp Cloud API</span>
            <StatusBadge enabled={settings.whatsapp.enabled} />
          </div>
        </AccordionTrigger>
        <AccordionContent className="pt-2 pb-4">
          <WhatsAppSettings settings={settings.whatsapp} />
        </AccordionContent>
      </AccordionItem>

      {/* 3. FTP/SFTP */}
      <AccordionItem value="ftp" className="border rounded-lg px-4">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-3">
            <HardDrive className="h-5 w-5 text-muted-foreground shrink-0" />
            <span className="font-medium">FTP / SFTP</span>
            <StatusBadge enabled={settings.ftp.enabled} />
          </div>
        </AccordionTrigger>
        <AccordionContent className="pt-2 pb-4">
          <FtpSettings settings={settings.ftp} />
        </AccordionContent>
      </AccordionItem>

      {/* 4. Telegram */}
      <AccordionItem value="telegram" className="border rounded-lg px-4">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-3">
            <Send className="h-5 w-5 text-muted-foreground shrink-0" />
            <span className="font-medium">Telegram Bot</span>
            <StatusBadge enabled={settings.telegram.enabled} />
          </div>
        </AccordionTrigger>
        <AccordionContent className="pt-2 pb-4">
          <TelegramSettings settings={settings.telegram} />
        </AccordionContent>
      </AccordionItem>

      {/* 5. LLM */}
      <AccordionItem value="llm" className="border rounded-lg px-4">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-3">
            <Brain className="h-5 w-5 text-muted-foreground shrink-0" />
            <span className="font-medium">LLM / AI</span>
            <StatusBadge enabled={settings.llm.enabled} />
          </div>
        </AccordionTrigger>
        <AccordionContent className="pt-2 pb-4">
          <LlmSettings settings={settings.llm} />
        </AccordionContent>
      </AccordionItem>

      {/* 6. Email / Gmail SMTP */}
      <AccordionItem value="email" className="border rounded-lg px-4">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-muted-foreground shrink-0" />
            <span className="font-medium">Email (Gmail SMTP)</span>
            <StatusBadge enabled={settings.email.enabled} />
          </div>
        </AccordionTrigger>
        <AccordionContent className="pt-2 pb-4">
          <EmailSettings settings={settings.email} />
        </AccordionContent>
      </AccordionItem>

      {/* 7. Fleet — alert thresholds for driver card */}
      <AccordionItem value="fleet" className="border rounded-lg px-4">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-3">
            <Car className="h-5 w-5 text-muted-foreground shrink-0" />
            <span className="font-medium">הגדרות צי רכב</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pt-2 pb-4">
          <FleetSettings settings={settings.fleet} />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

// ─────────────────────────────────────────────────────────────
// StatusBadge — shows enabled/disabled status for each integration
// ─────────────────────────────────────────────────────────────

function StatusBadge({ enabled }: { enabled: boolean }) {
  return (
    <Badge
      variant={enabled ? 'default' : 'secondary'}
      className={enabled ? 'bg-green-100 text-green-800 hover:bg-green-100' : ''}
    >
      {enabled ? 'פעיל' : 'מושבת'}
    </Badge>
  )
}
