import { CssBaseline, ThemeProvider } from '@mui/material';
import theme from './theme/crateTheme';
import adminTheme from './theme/adminTheme';
import { clearSession, getSession } from './services/session';
import AppHeader from './components/layout/AppHeader';
import ConsoleHeader from './components/layout/ConsoleHeader';
import LoginPage from './features/login/LoginPage';
import RegisterPage from './features/register/RegisterPage';
import DashboardPage from './features/dashboard/DashboardPage';
import ReportIncidentPage from './features/incidents/report/ReportIncidentPage';

const ROLE_LABELS = { employee: 'Employee', engineer: 'Engineer', admin: 'Facility admin' };

const initialsOf = (name) => name.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

function signOut() {
  clearSession();
  window.location.assign('/login');
}

// Path-based switch until React Router arrives with more app screens.
function route(path) {
  if (path.startsWith('/register')) return <RegisterPage />;
  if (path.startsWith('/login')) return <LoginPage onSignedIn={() => window.location.assign('/dashboard')} />;

  // Everything else needs a session.
  const session = getSession();
  if (!session) {
    window.location.replace('/login');
    return null;
  }
  const { user } = session;
  // Reporting keeps the crate-wood look with its own header; the dashboard
  // uses the console theme and header (see App() below).
  if (path.startsWith('/incidents/new')) {
    return (
      <>
        <AppHeader
          userLabel={`${user.full_name} · ${ROLE_LABELS[user.role] ?? user.role}`}
          onSignOut={signOut}
          links={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Report', href: '/incidents/new', active: true },
          ]}
        />
        <ReportIncidentPage />
      </>
    );
  }

  return (
    <>
      <ConsoleHeader
        name={user.full_name}
        role={ROLE_LABELS[user.role] ?? user.role}
        initials={initialsOf(user.full_name)}
        onSignOut={signOut}
        links={[{ label: 'Dashboard', href: '/dashboard', active: true }]}
      />
      <DashboardPage user={{ firstName: user.full_name.split(' ')[0] }} />
    </>
  );
}

export default function App() {
  const path = window.location.pathname;
  const useConsoleTheme = path.startsWith('/dashboard');
  return (
    <ThemeProvider theme={useConsoleTheme ? adminTheme : theme}>
      <CssBaseline />
      {route(path)}
    </ThemeProvider>
  );
}
