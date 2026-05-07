update public.report_profile
set
  name = 'Player Assessment Default',
  description = 'Selector-focused player assessment report with current-series and overall stats, peer strip, and trend graphics.',
  theme_name = 'game-changrs-player-assessment-dark'
where profile_key = 'executive-selector-default';
