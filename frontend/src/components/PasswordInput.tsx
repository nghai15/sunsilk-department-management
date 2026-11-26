import { useId, useState, type InputHTMLAttributes } from 'react'

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

export default function PasswordInput({ className = '', id, disabled, ...props }: PasswordInputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const [visible, setVisible] = useState(false)
  const spacing = className.match(/\bmt-\S+/g)?.join(' ') ?? ''
  const inputClasses = className.replace(/\bmt-\S+/g, '')

  return <span className={`relative block ${spacing}`}>
    <input {...props} id={inputId} type={visible ? 'text' : 'password'} disabled={disabled} className={inputClasses} style={{ ...props.style, paddingRight: '3.5rem' }} />
    <button type="button" aria-controls={inputId} aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={visible} disabled={disabled} onClick={() => setVisible(value => !value)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md text-xs font-medium text-emerald-900 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-50" style={{ height: '28px', minHeight: 0, padding: '0 8px', fontSize: '12px', lineHeight: 1 }}>{visible ? 'Ẩn' : 'Hiện'}</button>
  </span>
}
