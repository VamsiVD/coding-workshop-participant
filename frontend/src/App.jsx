// Root component: applies the MUI theme and picks which screen to show from the
// URL path. Session and role checks for the signed-in screens live here too.
import { CssBaseline, ThemeProvider } from '@mui/material';
import adminTheme from './theme/adminTheme';
import { clearSession, getSession } from './services/session';
import ConsoleHeader from './components/layout/ConsoleHeader';
import LoginPage from './features/login/LoginPage';
import RegisterPage from './features/register/RegisterPage';
import DashboardPage from './features/dashboard/DashboardPage';
import ReportIncidentPage from './features/incidents/report/ReportIncidentPage';
import AdminIncidentsPage from './features/admin/AdminIncidentsPage';
import EngineerWorkbenchPage from './features/engineer/EngineerWorkbenchPage';
import AdminEngineersPage from './features/admin/engineers/AdminEngineersPage';

// Maps the backend's role keys to the text shown under the user's name in the header.
const ROLE_LABELS = { employee: 'Employee', engineer: 'Engineer', admin: 'Facility admin' };

// Where a signed-in user lands: administrators on the operations console,
// engineers on their workbench, employees on their own dashboard.
const HOME = { admin: '/admin/incidents', engineer: '/engineer' };
const homeFor = (user) => HOME[user.role] ?? '/dashboard';

// Header links for the engineer's own screens; `active` marks the current one.
const engineerLinks = (active) => [
  { label: 'My work', href: '/engineer', active: active === 'work' },
  { label: 'Report', href: '/incidents/new', active: active === 'report' },
  { label: 'Dashboard', href: '/dashboard', active: active === 'dashboard' },
];
// [CONCEPT: Pure helper function] homeFor and initialsOf only compute from their input, so they are easy to test.
// initialsOf turns "Maria Okafor" into "MO" for the avatar circle.
const initialsOf = (name) => name.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

// Full page load to /login (not a state change) so every screen starts fresh without the old session.
function signOut() {
  clearSession();
  window.location.assign('/login');
}

// Path-based switch until React Router arrives with more app screens.
// [CONCEPT: Client-side routing] A hand-rolled router: reads the path once per page load.
// Links are plain <a href>, so each navigation reloads the page and calls this again.
function route(path) {
  if (path.startsWith('/register')) return <RegisterPage />;
  // [CONCEPT: Props] onSignedIn is a callback prop: LoginPage reports the user, App decides where to go.
  if (path.startsWith('/login')) return <LoginPage onSignedIn={(user) => window.location.assign(homeFor(user))} />;

  // Everything else needs a session.
  // [CONCEPT: Browser storage] getSession reads the token saved in local/sessionStorage at sign-in.
  const session = getSession();
  if (!session) {
    // replace (not assign) so the Back button does not return to the protected page.
    // [CONCEPT: Conditional rendering] Returning null renders nothing while the browser redirects.
    window.location.replace('/login');
    return null;
  }
  const { user } = session;

  // Reporting shares the console theme and header with the dashboard.
  if (path.startsWith('/incidents/new')) {
    return (
      <>
        {/* [CONCEPT: Fragment] <>...</> groups the header and page without adding an extra DOM element. */}
        {/* [CONCEPT: Component composition] Each screen is built from a shared header plus a feature page. */}
        <ConsoleHeader
          name={user.full_name}
          role={ROLE_LABELS[user.role] ?? user.role}
          initials={initialsOf(user.full_name)}
          onSignOut={signOut}
          links={user.role === 'engineer' ? engineerLinks('report') : [
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Report', href: '/incidents/new', active: true },
            // [CONCEPT: Role-based rendering] Only admins get the Admin link; the spread adds nothing for other roles.
            ...(user.role === 'admin' ? [{ label: 'Admin', href: '/admin/incidents' }] : []),
          ]}
        />
        <ReportIncidentPage />
      </>
    );
  }

  if (path.startsWith('/engineer')) {
    // The workbench reads the caller's engineer profile, which only engineers have.
    if (user.role !== 'engineer') {
      window.location.replace(homeFor(user));
      return null;
    }
    return (
      <>
        <ConsoleHeader
          name={user.full_name}
          role={ROLE_LABELS.engineer}
          initials={initialsOf(user.full_name)}
          onSignOut={signOut}
          links={engineerLinks('work')}
        />
        <EngineerWorkbenchPage />
      </>
    );
  }

  if (path.startsWith('/admin')) {
    const onEngineers = path.startsWith('/admin/engineers');
    // The server refuses admin calls from other roles; send them home instead
    // of showing an empty console.
    // [CONCEPT: Role-based rendering] A UI guard only; the real protection is the server's role check.
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
            { label: 'Incidents', href: '/admin/incidents', active: !onEngineers },
            { label: 'Engineers', href: '/admin/engineers', active: onEngineers },
            { label: 'My dashboard', href: '/dashboard' },
          ]}
        />
        {/* [CONCEPT: Conditional rendering] One admin shell, two screens chosen by the path. */}
        {onEngineers ? <AdminEngineersPage /> : <AdminIncidentsPage />}
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
        links={user.role === 'engineer' ? engineerLinks('dashboard') : [
          { label: 'Dashboard', href: '/dashboard', active: true },
          ...(user.role === 'admin' ? [{ label: 'Admin', href: '/admin/incidents' }] : []),
        ]}
      />
      {/* The dashboard greets the user by first name only. */}
      <DashboardPage user={{ firstName: user.full_name.split(' ')[0] }} />
    </>
  );
}

// [CONCEPT: Component] App is the top-level component rendered by main.jsx.
export default function App() {
  return (
    // [CONCEPT: MUI theme] ThemeProvider makes adminTheme's colours, fonts and component defaults
    // available to every MUI component below it.
    <ThemeProvider theme={adminTheme}>
      {/* CssBaseline resets browser styles and applies the theme's global body styles. */}
      <CssBaseline />
      {/* [CONCEPT: JSX expression] Curly braces embed the element returned by route() for the current URL. */}
      {route(window.location.pathname)}
    </ThemeProvider>
  );
}
