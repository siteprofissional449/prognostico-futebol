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
        aria-label="Jogos"
        title="Jogos"
        className={({ isActive }) =>
          `${classes.item} ${isActive ? classes.active : ''}`
        }
      >
        <IconHome size={22} stroke={1.5} className={classes.icon} />
        <span className={`${classes.label} ${classes.labelMobileHidden}`}>Jogos</span>
      </NavLink>

      <NavLink
        to="/prognosticos"
        aria-label="Palpites"
        title="Palpites"
        className={({ isActive }) =>
          `${classes.item} ${isActive ? classes.active : ''}`
        }
      >
        <IconBallFootball size={22} stroke={1.5} className={classes.icon} />
        <span className={`${classes.label} ${classes.labelMobileHidden}`}>Palpites</span>
      </NavLink>

      {showHistory && (
        <NavLink
          to="/historico"
          aria-label="Histórico"
          title="Histórico"
          className={({ isActive }) =>
            `${classes.item} ${isActive ? classes.active : ''}`
          }
        >
          <IconHistory size={22} stroke={1.5} className={classes.icon} />
          <span className={`${classes.label} ${classes.labelMobileHidden}`}>Histórico</span>
        </NavLink>
      )}

      <NavLink
        to="/planos"
        aria-label="Planos"
        title="Planos"
        className={({ isActive }) =>
          `${classes.item} ${isActive ? classes.active : ''}`
        }
      >
        <IconCreditCard size={22} stroke={1.5} className={classes.icon} />
        <span className={`${classes.label} ${classes.labelMobileHidden}`}>Planos</span>
      </NavLink>

      <NavLink
        to="/premium"
        aria-label="VIP"
        title="VIP"
        className={({ isActive }) =>
          `${classes.item} ${isActive ? classes.active : ''}`
        }
      >
        <IconCrown size={22} stroke={1.5} className={classes.icon} />
        <span className={`${classes.label} ${classes.labelMobileHidden}`}>VIP</span>
      </NavLink>

      <NavLink
        to={accountTo}
        state={!isLoggedIn ? { from: pathname } : undefined}
        aria-label={isLoggedIn ? 'Conta' : 'Entrar'}
        title={isLoggedIn ? 'Conta' : 'Entrar'}
        className={({ isActive }) =>
          `${classes.item} ${isActive ? classes.active : ''}`
        }
      >
        <AccountIcon size={22} stroke={1.5} className={classes.icon} />
        <span className={`${classes.label} ${classes.labelMobileHidden}`}>{isLoggedIn ? 'Conta' : 'Entrar'}</span>
      </NavLink>
    </nav>
  );
}
