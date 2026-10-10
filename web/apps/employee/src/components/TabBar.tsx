import { NavLink } from 'react-router-dom'
import { CalendarIcon, HomeIcon, PersonIcon, WalletIcon } from './icons'

const tabs = [
  { to: '/', label: 'Inicio', Icon: HomeIcon, end: true },
  { to: '/payroll', label: 'Payroll', Icon: WalletIcon },
  { to: '/time', label: 'Tiempo', Icon: CalendarIcon },
  { to: '/me', label: 'Yo', Icon: PersonIcon },
]

export function TabBar() {
  return (
    <nav className="tabbar" aria-label="Navegación principal">
      {tabs.map(({ to, label, Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
          <Icon />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
