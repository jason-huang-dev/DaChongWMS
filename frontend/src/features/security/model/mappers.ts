import type {
  AccessInviteFormValues,
  CompanyInviteRecord,
  CompanyMembershipFormValues,
  CompanyMembershipRecord,
  StaffFormValues,
  StaffRecord,
} from "@/features/security/model/types";

export const defaultStaffFormValues: StaffFormValues = {
  staff_name: "",
  staff_type: "",
  check_code: 8888,
  is_lock: false,
};

export function mapStaffRecordToFormValues(record: StaffRecord): StaffFormValues {
  return {
    staff_name: record.staff_name,
    staff_type: record.staff_type,
    check_code: record.check_code,
    is_lock: record.is_lock,
  };
}

export const defaultCompanyMembershipFormValues: CompanyMembershipFormValues = {
  username: "",
  email: "",
  password: "",
  staff_name: "",
  staff_type: "",
  check_code: 8888,
  is_lock: false,
  is_company_admin: false,
  can_manage_users: false,
  is_active: true,
  default_warehouse: null,
};

export function mapCompanyMembershipRecordToFormValues(record: CompanyMembershipRecord): CompanyMembershipFormValues {
  return {
    username: record.username,
    email: record.email,
    password: "",
    staff_name: record.staff_name,
    staff_type: record.staff_type,
    check_code: record.check_code,
    is_lock: record.is_lock,
    is_company_admin: record.is_company_admin,
    can_manage_users: record.can_manage_users,
    is_active: record.is_active,
    default_warehouse: record.default_warehouse,
  };
}

export const defaultAccessInviteFormValues: AccessInviteFormValues = {
  email: "",
  staff_name: "",
  staff_type: "",
  check_code: 8888,
  default_warehouse: null,
  is_company_admin: false,
  can_manage_users: false,
  invite_message: "",
  expires_in_days: 7,
};

export function mapCompanyInviteRecordToFormValues(record: CompanyInviteRecord): AccessInviteFormValues {
  return {
    email: record.email,
    staff_name: record.staff_name,
    staff_type: record.staff_type,
    check_code: record.check_code,
    default_warehouse: record.default_warehouse,
    is_company_admin: record.is_company_admin,
    can_manage_users: record.can_manage_users,
    invite_message: record.invite_message,
    expires_in_days: 7,
  };
}
