import { CssBaseline, ThemeProvider } from '@mui/material';
import adminTheme from './theme/adminTheme';
import { clearSession, getSession } from './services/session';
import ConsoleHeader from './components/layout/ConsoleHeader';
import LoginPage from './features/login/LoginPage';
import RegisterPage from './features/register/RegisterPage';
import DashboardPage from './features/dashboard/DashboardPage';
import ReportIncidentPage from './features/incidents/report/ReportIncidentPage';
import AdminIncidentsPage from './features/admin/AdminIncidentsPage';

const ROLE_LABELS = { employee: 'Employee', engineer: 'Engineer', admin: 'Facility admin' };

// Where a signed-in user lands: administrators on the operations console,
// everyone else on their own dashboard.
const homeFor = (user) => (user.role === 'admin' ? '/admin/incidents' : '/dashboard');
const initialsOf = (name) => name.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

function signOut() {
  clearSession();
  window.location.assign('/login');
}

// Path-based switch until React Router arrives with more app screens.
function route(path) {
  if (path.startsWith('/register')) return <RegisterPage />;
  if (path.startsWith('/login')) return <LoginPage onSignedIn={(user) => window.location.assign(homeFor(user))} />;

  // Everything else needs a session.
  const session = getSession();
  if (!session) {
    window.location.replace('/login');
    return null;
  }
  const { user } = session;

  // Reporting shares the console theme and header with the dashboard.
  if (path.startsWith('/incidents/new')) {
    return (
      <>
        <ConsoleHeader
          name={user.full_name}
          role={ROLE_LABELS[user.role] ?? user.role}
          initials={initialsOf(user.full_name)}
          onSignOut={signOut}
          links={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Report', href: '/incidents/new', active: true },
            ...(user.role === 'admin' ? [{ label: 'Admin', href: '/admin/incidents' }] : []),
          ]}
        />
        <ReportIncidentPage />
      </>
    );
  }

  if (path.startsWith('/admin')) {
    // The server refuses admin calls from other roles; send them home instead
    // of showing an empty console.
    if (user.role !== 'admin') {
      window.location.replace('/dashboard');
      return null;
    }
    return (
      <>
        <ConsoleHeader
          name={user.full_name}
          role={ROLE_LABELS.admin}
          initials={initialsOf(user.full_name)}
          onSignOut={signOut}
          links={[
            { label: 'Incidents', href: '/admin/incidents', active: true },
            { label: 'My dashboard', href: '/dashboard' },
          ]}
        />
        <AdminIncidentsPage />
      </>
    );
  }

  // The dashboard shares the console theme and header with the admin screens.
  return (
    <>
      <ConsoleHeader
        name={user.full_name}
        role={ROLE_LABELS[user.role] ?? user.role}
        initials={initialsOf(user.full_name)}
        onSignOut={signOut}
        links={[
          { label: 'Dashboard', href: '/dashboard', active: true },
          ...(user.role === 'admin' ? [{ label: 'Admin', href: '/admin/incidents' }] : []),
        ]}
      />
      <DashboardPage user={{ firstName: user.full_name.split(' ')[0] }} />
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider theme={adminTheme}>
      <CssBaseline />
      {route(window.location.pathname)}
    </ThemeProvider>
  );
}
