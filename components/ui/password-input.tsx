'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  id: string
}

export function PasswordInput({ label, id, placeholder, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div>
      <label className="block text-sm font-semibold text-[#53685d] mb-1.5" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          placeholder={placeholder}
          className="w-full border border-[#d9cec1] bg-[#fffdf9] rounded-xl px-3.5 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-[#7d9d84]/30 focus:border-[#91aa96]"
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-lg text-[#929991] hover:text-[#4e6659] hover:bg-[#f0ece4] transition-colors"
          tabIndex={-1}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}
