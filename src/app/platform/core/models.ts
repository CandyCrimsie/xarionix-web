// Core UUIDs deliberately do not share the ERP numeric company model.
export type UUID = string & { readonly __coreUuid: unique symbol };
export function uuid(value: string): UUID {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))
    throw new Error('Некорректный UUID Core');
  return value as UUID;
}
export interface Page<T> {
  items: T[];
  limit: number;
  offset: number;
  total?: number;
}
export interface Profile {
  id: UUID;
  user_id: UUID;
  issuer: string;
  subject: string;
  principal_type: 'human' | 'service' | 'unclassified';
  display_name: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}
export interface Company {
  id: UUID;
  name: string;
  slug: string;
  status: 'active' | 'suspended' | 'archived';
  created_by_user_id: UUID;
  created_at: string;
  updated_at: string;
}
export interface EffectivePermissions {
  company_id: UUID;
  membership_id: UUID;
  owner: boolean;
  permissions: string[];
}
export interface Member {
  id: UUID;
  company_id: UUID;
  user_id: UUID;
  role: 'owner' | 'admin' | 'member';
  status: string;
  joined_at: string;
}
export interface Employee {
  id: UUID;
  company_id: UUID;
  user_id: UUID | null;
  display_name: string;
  position: string | null;
  department: string | null;
  status: string;
}
export interface Invitation {
  id: UUID;
  company_id: UUID;
  role: string;
  status: string;
  expires_at: string;
  recipient_user_id: UUID | null;
  recipient_email: string | null;
}
export interface Role {
  id: UUID;
  company_id: UUID;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
  is_system: boolean;
  version: number;
  definition_version: number;
}
export interface Permission {
  key: string;
  namespace: string;
  description: string;
  scope: string;
  protected: boolean;
  owner_grantable: boolean;
}
export interface RoleTemplate {
  key: string;
  version: number;
  name: string;
  permissions: string[];
}
export interface PlatformUser {
  id: UUID;
  display_name: string | null;
  status: string;
  created_at: string;
}
export interface PlatformAdmin {
  user_id: UUID;
  active: boolean;
  created_at: string;
}
export interface CompanyRequest {
  id: UUID;
  requested_by_user_id: UUID;
  name: string;
  requested_slug: string;
  status: string;
  review_comment: string | null;
}
export interface PlatformSettings {
  company_creation_policy: 'closed' | 'approval' | 'open';
  max_owned_companies_per_user: number;
  invitations_enabled: boolean;
}
export interface AuditEvent {
  id: UUID;
  action: string;
  resource_type: string;
  resource_id: UUID | null;
  actor_user_id: UUID | null;
  actor_identity_id: UUID | null;
  company_id: UUID | null;
  request_id: string | null;
  created_at: string;
  details: Record<string, unknown>;
}
export interface Publisher {
  id: UUID;
  publisher_id: string;
  display_name: string;
  status: 'active' | 'revoked';
  created_at: string;
}
export interface SigningKey {
  id: UUID;
  key_id: string;
  public_key: string;
  fingerprint: string;
  status: string;
  algorithm: 'Ed25519';
  revoked_at: string | null;
}
export interface NamespaceGrant {
  namespace: string;
  status: string;
}
export interface Package {
  id: UUID;
  module_id: string;
  version: string;
  publisher_id: string;
  key_id: string;
  key_fingerprint: string;
  package_sha256: string;
  manifest_sha256: string;
  size: number;
  state: string;
  current_trust: boolean;
  core_compatible: boolean;
  blob_integrity: string;
  created_at: string;
  verified_at: string;
  dependency_report?: Record<string, unknown>;
}
export interface Manifest {
  schema_version: 1;
  module: {
    id: string;
    name: string;
    version: string;
    description: string;
    type: 'standard' | 'autonomous';
    homepage?: string | null;
  };
  publisher: { id: string };
  compatibility: { core: string; module_protocol: 1 };
  permissions: {
    namespace: string;
    definitions: { key: string; description: string; scope: string }[];
  };
  dependencies: { module_id: string; version: string; publisher_id: string }[];
  artifacts: { path: string; size: number; sha256: string }[];
}
export interface Installation {
  id: UUID;
  module_id: string;
  publisher_id: UUID;
  package_id: UUID;
  package_sha256: string;
  version: string;
  module_type: 'standard' | 'autonomous';
  namespace: string;
  status: 'installed_disabled' | 'installed_enabled' | 'removed';
  generation: number;
  previous_package_id: UUID | null;
  current_trust: boolean;
  runtime: Record<string, unknown>;
}
export type InstallAction = 'install' | 'enable' | 'disable' | 'update' | 'uninstall' | 'rollback';
export interface InstallPlanBody {
  action: InstallAction;
  module_id: string;
  package_id: UUID;
  package_sha256: string;
  target_version: string;
  module_type: string;
  expected_generation: number;
  current_version: string | null;
  current_state: string | null;
  next_state: string;
  core_compatible: boolean;
  protocol_supported: boolean;
  permission_diff: Record<string, unknown>;
  dependency_graph: Record<string, unknown>;
  blockers: string[];
  warnings: string[];
  ready: boolean;
  runtime_provisioning: string;
  authorities: Record<string, unknown>[];
}
export interface InstallPlan {
  id: UUID;
  digest: string;
  state: string;
  created_at: string;
  expires_at: string;
  approved_by: UUID | null;
  approved_at: string | null;
  approved_until: string | null;
  plan: InstallPlanBody;
}
export interface InstallOperation {
  id: UUID;
  plan_id: UUID;
  state: string;
  attempts: number;
  safe_error_code: string | null;
  started_at: string | null;
  completed_at: string | null;
  correlation_id: string;
  failures: unknown[];
}
export interface InstallationHistory {
  id: UUID;
  operation_id: UUID;
  previous_package_id: UUID | null;
  package_id: UUID;
  previous_state: string;
  state: string;
  generation: number;
  performed_by: UUID;
  created_at: string;
}
export interface DeploymentHost {
  id: UUID;
  name: string;
  status: 'active' | 'disabled' | 'revoked';
  revision: number;
  engine_id: string;
  platform: string;
  owner_user_id: UUID;
  last_seen: string | null;
}
export type DeploymentAction =
  | 'backup'
  | 'restore'
  | 'provision'
  | 'start'
  | 'stop'
  | 'restart'
  | 'upgrade'
  | 'rollback'
  | 'deprovision'
  | 'inspect'
  | 'reconcile'
  | 'quarantine'
  | 'retire';
export interface DeploymentStorage {
  epoch_id: UUID;
  next_epoch_id: UUID;
  allocation_revision: number;
  expected_schema_version: number;
  target_schema_version: number;
  compatible_minimum: number;
  compatible_maximum: number;
  maximum_bytes: number;
  sdk_sha256: string;
  package_version: string;
  backup_id: UUID | null;
  backup_sha256: string | null;
  allow_migration: boolean;
}
export interface DeploymentPlanBody {
  installation_id: UUID;
  host_id: UUID;
  operation: DeploymentAction;
  installation_generation: number;
  expected_deployment_generation: number;
  package_id: UUID;
  package_sha256: string;
  package_size: number;
  engine_id: string;
  host_revision: number;
  profile: string;
  resource_policy: Record<string, number>;
  runtime: Record<string, unknown>;
  policy: Record<string, unknown>;
  storage?: DeploymentStorage;
}
export interface DeploymentPlan {
  id: UUID;
  state: string;
  digest: string;
  body: DeploymentPlanBody;
  expires_at: string;
  approved_until: string | null;
}
export interface RuntimeDeployment {
  installation_id: UUID;
  host_id: UUID;
  package_id: UUID;
  installation_generation: number;
  generation: number;
  desired: string;
  observed_generation: number;
  observed: string;
  health: string;
  container_id: string | null;
  image_digest: string;
  observed_image_digest: string | null;
  profile: string;
  last_seen: string | null;
  last_live: string | null;
  last_ready: string | null;
  restart_count: number;
  safe_error_code: string | null;
}
export interface DeploymentJob {
  id: UUID;
  generation: number;
  operation: DeploymentAction;
  state: 'queued' | 'leased' | 'succeeded' | 'failed' | 'expired' | 'cancelled';
  attempts: number;
  result: Record<string, unknown> | null;
}
export interface QueuedJob {
  job_id: UUID;
  state: string;
  generation: number;
}

export interface ModuleDataBackup {
  id: UUID;
  data_schema_version: number;
  sha256: string;
  size: number;
  package_version: string;
  created_at: string;
}
export interface ModuleStorageView extends Page<ModuleDataBackup> {
  allocation: {
    installation_id: UUID;
    host_id: UUID;
    epoch_id: UUID;
    revision: number;
    data_schema_version: number;
    maximum_bytes: number;
    retained_epoch_count: number;
    deletion_supported: false;
  } | null;
}
export function runtimeFresh(runtime: RuntimeDeployment, now = Date.now()): boolean {
  return (
    !!runtime.last_seen &&
    now - Date.parse(runtime.last_seen) < 90_000 &&
    now >= Date.parse(runtime.last_seen) &&
    runtime.observed_generation === runtime.generation &&
    runtime.image_digest === runtime.observed_image_digest
  );
}
export function runtimeObservation(
  runtime: Record<string, unknown>,
  now: number,
): Record<string, unknown> {
  const heartbeat = runtime['last_heartbeat'];
  const stale =
    ['healthy', 'connected'].includes(String(runtime['state'])) &&
    (typeof heartbeat !== 'string' ||
      !Number.isFinite(Date.parse(heartbeat)) ||
      now - Date.parse(heartbeat) > 90000 ||
      now < Date.parse(heartbeat));
  return stale ? { ...runtime, state: 'stale' } : runtime;
}
