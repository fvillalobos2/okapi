export type AppRole = 'super_admin' | 'team_admin' | 'agent' | 'viewer'

export const ROLES: readonly AppRole[] = ['viewer', 'agent', 'team_admin', 'super_admin']

export const ROLE_LABEL: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  team_admin: 'Admin Sucursal',
  agent: 'Agente',
  viewer: 'Solo lectura',
}

export function roleRank(role: AppRole): number {
  switch (role) {
    case 'super_admin': return 4
    case 'team_admin':  return 3
    case 'agent':       return 2
    case 'viewer':      return 1
  }
}

export function hasMinRole(role: AppRole, min: AppRole): boolean {
  return roleRank(role) >= roleRank(min)
}

export function isAppRole(v: unknown): v is AppRole {
  return typeof v === 'string' && (ROLES as readonly string[]).includes(v)
}

// Capability predicates — single source of truth for both UI gates and API guards
export const can = {
  /** Edit business settings, WhatsApp config, add-ons */
  editSettings:    (r: AppRole) => hasMinRole(r, 'super_admin'),
  /** Invite / edit / deactivate users */
  manageUsers:     (r: AppRole) => hasMinRole(r, 'super_admin'),
  /** Send messages, run broadcasts, create/edit leads */
  sendMessages:    (r: AppRole) => hasMinRole(r, 'agent'),
  /** Assign conversations, change status */
  assignConvs:     (r: AppRole) => hasMinRole(r, 'team_admin'),
  /** View everything (conversations, leads, broadcasts) */
  viewData:        (r: AppRole) => hasMinRole(r, 'viewer'),
  /** Manage teams / branches */
  manageTeams:     (r: AppRole) => hasMinRole(r, 'team_admin'),
}
