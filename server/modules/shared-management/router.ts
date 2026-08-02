// The shared workflow is mounted by each business module through its own
// adapter. Module guards and API scope are resolved from the mount path.
export { studentManagementRouter as sharedManagementRouter } from "../student-management/router";
