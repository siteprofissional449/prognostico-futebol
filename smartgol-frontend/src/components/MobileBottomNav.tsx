import { NavLink, useLocation } from 'react-router-dom';
import {
  IconHome,
  IconBallFootball,
  IconHistory,
  IconCreditCard,
  IconCrown,
  IconUser,
  IconLogin,
} from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { canSeeHistory } from '../utils/planAccess';
import classes from './MobileBottomNav.module.css';

export function MobileBottomNav() {
  const { pathname } = useLocation();
  const { isLoggedIn, plan } = useAuth();

  if (pathname.startsWith('/admin')) {
    return null;
  }

  const showHistory = isLoggedIn && canSeeHistory(plan);
  const accountTo = isLoggedIn ? '/premium' : '/login';
  const AccountIcon = isLoggedIn ? IconUser : IconLogin;

  return (
    <nav className={classes.bar} aria-label="Navegação principal">
      <NavLink
        to="/"
        end
        className={({ isActive }) =>
          `${classes.item} ${isActive ? classes.active : ''}`
        }
      >
        <IconHome size={22} stroke={1.5} className={classes.icon} />
        <span className={classes.label}>Jogos</span>
      </NavLink>

      <NavLink
        to="/prognosticos"
        className={({ isActive }) =>
          `${classes.item} ${isActive ? classes.active : ''}`
        }
      >
        <IconBallFootball size={22} stroke={1.5} className={classes.icon} />
        <span className={classes.label}>Palpites</span>
      </NavLink>

      {showHistory && (
        <NavLink
          to="/historico"
          className={({ isActive }) =>
            `${classes.item} ${isActive ? classes.active : ''}`
          }
        >
          <IconHistory size={22} stroke={1.5} className={classes.icon} />
          <span className={classes.label}>Histórico</span>
        </NavLink>
      )}

      <NavLink
        to="/planos"
        className={({ isActive }) =>
          `${classes.item} ${isActive ? classes.active : ''}`
        }
      >
        <IconCreditCard size={22} stroke={1.5} className={classes.icon} />
        <span className={classes.label}>Planos</span>
      </NavLink>

      <NavLink
        to="/premium"
        className={({ isActive }) =>
          `${classes.item} ${isActive ? classes.active : ''}`
        }
      >
        <IconCrown size={22} stroke={1.5} className={classes.icon} />
        <span className={classes.label}>VIP</span>
      </NavLink>

      <NavLink
        to={accountTo}
        state={!isLoggedIn ? { from: pathname } : undefined}
        className={({ isActive }) =>
          `${classes.item} ${isActive ? classes.active : ''}`
        }
      >
        <AccountIcon size={22} stroke={1.5} className={classes.icon} />
        <span className={classes.label}>{isLoggedIn ? 'Conta' : 'Entrar'}</span>
      </NavLink>
    </nav>
  );
}
