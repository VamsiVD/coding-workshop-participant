import { CssBaseline, ThemeProvider } from '@mui/material';
import theme from './theme/crateTheme';
import { clearSession, getSession } from './services/session';
import AppHeader from './components/layout/AppHeader';
import LoginPage from './features/login/LoginPage';
import RegisterPage from './features/register/RegisterPage';
import DashboardPage from './features/dashboard/DashboardPage';
import ReportIncidentPage from './features/incidents/report/ReportIncidentPage';

const ROLE_LABELS = { employee: 'Employee', engineer: 'Engineer', admin: 'Facility admin' };

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
  const reporting = path.startsWith('/incidents/new');
  return (
    <>
      <AppHeader
        userLabel={`${user.full_name} · ${ROLE_LABELS[user.role] ?? user.role}`}
        showReportButton={!reporting}
        onSignOut={signOut}
        links={[
          { label: 'Dashboard', href: '/dashboard', active: !reporting },
          { label: 'Report', href: '/incidents/new', active: reporting },
        ]}
      />
      {reporting
        ? <ReportIncidentPage />
        : <DashboardPage user={{ firstName: user.full_name.split(' ')[0] }} />}
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {route(window.location.pathname)}
    </ThemeProvider>
  );
}
