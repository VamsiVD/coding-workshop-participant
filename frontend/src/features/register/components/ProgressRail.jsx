import { Box, Step, StepConnector, StepLabel, Stepper, Typography, stepConnectorClasses } from '@mui/material';
import { styled } from '@mui/material/styles';
import CheckIcon from '@mui/icons-material/Check';
import { crate, fonts } from '../../../theme/crateTheme';

const Connector = styled(StepConnector)({
  marginLeft: 15,
  [`& .${stepConnectorClasses.line}`]: { borderLeftWidth: 2, borderColor: 'rgba(243,230,200,.25)', minHeight: 18 },
});

function CrateStepIcon({ active, completed, icon }) {
  const lit = active || completed;
  return (
    <Box
      sx={{
        width: 32,
        height: 32,
        border: '2px solid',
        borderColor: lit ? crate.redBright : 'rgba(243,230,200,.4)',
        bgcolor: completed ? crate.redBright : 'transparent',
        color: crate.paper,
        display: 'grid',
        placeItems: 'center',
        fontFamily: fonts.heading,
        fontWeight: 600,
        fontSize: 14,
      }}
    >
      {completed ? <CheckIcon sx={{ fontSize: 18 }} /> : icon}
    </Box>
  );
}

export default function ProgressRail({ steps, activeStep }) {
  return (
    <Stepper
      orientation="vertical"
      activeStep={activeStep}
      connector={<Connector />}
      sx={{
        '& .MuiStepLabel-label': {
          color: crate.paper,
          opacity: 0.6,
          fontFamily: fonts.heading,
          fontWeight: 600,
          fontSize: 14,
          letterSpacing: '.1em',
          textTransform: 'uppercase',
        },
        '& .MuiStepLabel-label.Mui-active, & .MuiStepLabel-label.Mui-completed': { color: crate.paper, opacity: 1, fontWeight: 600 },
        '& .MuiStepLabel-iconContainer': { pr: 1.75 },
      }}
    >
      {steps.map((s) => (
        <Step key={s.label}>
          <StepLabel
            StepIconComponent={CrateStepIcon}
            optional={<Typography variant="caption" sx={{ color: crate.paper, opacity: 0.8 }}>{s.sub}</Typography>}
          >
            {s.label}
          </StepLabel>
        </Step>
      ))}
    </Stepper>
  );
}
