export interface DemoCredentials {
  email: string;
  password: string;
  displayName: string;
  workspaceName: string;
  subject: string;
  hoursPerDay: number;
  examInDays: number;
}

export const DEMO_CREDENTIALS: DemoCredentials = {
  email: "admin@gapfinder.demo",
  password: "GapFinder-Admin-2026!",
  displayName: "Demo Admin",
  workspaceName: "Operating Systems — End Semester Prep",
  subject: "Operating Systems — Units 2 to 4",
  hoursPerDay: 2,
  examInDays: 10,
};
