const fs = require('fs')

const path = 'lib/supabase/database.types.ts'
let s = fs.readFileSync(path, 'utf8')

// Appointments — fields introduced by migration 037.
s = s.replace(
  '          source: string\n          created_at: string',
  '          source: string\n          client_confirmed_at: string | null\n          client_confirmation_text: string | null\n          created_at: string'
)
s = s.replace(
  '          source?: string\n          created_at?: string',
  '          source?: string\n          client_confirmed_at?: string | null\n          client_confirmation_text?: string | null\n          created_at?: string'
)

if (!s.includes('      business_automation_rules: {')) {
  const tables = `      business_automation_rules: {
        Row: {
          id: string
          business_id: string
          rule_key: string
          name: string
          event_type: string
          offset_minutes: number
          enabled: boolean
          message_template: string
          requires_reply_confirmation: boolean
          confirmation_keywords: string[]
          is_system: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          rule_key: string
          name: string
          event_type: string
          offset_minutes?: number
          enabled?: boolean
          message_template: string
          requires_reply_confirmation?: boolean
          confirmation_keywords?: string[]
          is_system?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          rule_key?: string
          name?: string
          event_type?: string
          offset_minutes?: number
          enabled?: boolean
          message_template?: string
          requires_reply_confirmation?: boolean
          confirmation_keywords?: string[]
          is_system?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_automation_rules_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      }
      business_evolution_config: {
        Row: {
          business_id: string
          api_url: string
          api_key: string
          instance_name: string
          enabled: boolean
          last_status: string | null
          last_checked_at: string | null
          webhook_secret: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          business_id: string
          api_url: string
          api_key: string
          instance_name: string
          enabled?: boolean
          last_status?: string | null
          last_checked_at?: string | null
          webhook_secret?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          api_url?: string
          api_key?: string
          instance_name?: string
          enabled?: boolean
          last_status?: string | null
          last_checked_at?: string | null
          webhook_secret?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_evolution_config_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          }
        ]
      }
`
  const marker = '      business_hours: {'
  if (!s.includes(marker)) throw new Error('Could not locate business_hours in database.types.ts')
  s = s.replace(marker, tables + marker)
}

fs.writeFileSync(path, s)
console.log('Agelya automation Supabase types patched.')
