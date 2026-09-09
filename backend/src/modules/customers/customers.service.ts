import type { FilterQuery } from 'mongoose';
import { AppError } from '../../utils/AppError.js';
import { logger } from '../../utils/logger.js';
import { CustomerModel, type Customer, type CustomerDocument } from './customer.model.js';
import type {
  CreateCustomerInput,
  ListCustomersQuery,
  UpdateCustomerInput,
} from './customers.validation.js';

const MONGO_DUPLICATE_KEY = 11000;

interface ListResult {
  customers: CustomerDocument[];
  total: number;
  page: number;
  limit: number;
}

export async function createCustomer(
  organizationId: string,
  input: CreateCustomerInput,
): Promise<CustomerDocument> {
  try {
    const customer = await CustomerModel.create({ ...input, organizationId });
    logger.info(
      { operation: 'customers.create', organizationId, customerId: customer.id },
      'Customer created',
    );
    return customer;
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new AppError(409, 'CUSTOMER_EMAIL_TAKEN', 'A customer with this email already exists');
    }
    throw err;
  }
}

export async function listCustomers(
  organizationId: string,
  query: ListCustomersQuery,
): Promise<ListResult> {
  const filter: FilterQuery<Customer> = { organizationId };
  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ name: pattern }, { email: pattern }];
  }

  const skip = (query.page - 1) * query.limit;
  const [customers, total] = await Promise.all([
    CustomerModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit),
    CustomerModel.countDocuments(filter),
  ]);

  return { customers, total, page: query.page, limit: query.limit };
}

export async function getCustomer(
  organizationId: string,
  customerId: string,
): Promise<CustomerDocument> {
  const customer = await CustomerModel.findOne({ _id: customerId, organizationId });
  if (!customer) {
    throw AppError.notFound('Customer not found');
  }
  return customer;
}

export async function updateCustomer(
  organizationId: string,
  customerId: string,
  input: UpdateCustomerInput,
): Promise<CustomerDocument> {
  try {
    const customer = await CustomerModel.findOneAndUpdate(
      { _id: customerId, organizationId },
      input,
      { new: true, runValidators: true },
    );
    if (!customer) {
      throw AppError.notFound('Customer not found');
    }
    return customer;
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new AppError(409, 'CUSTOMER_EMAIL_TAKEN', 'A customer with this email already exists');
    }
    throw err;
  }
}

export async function deleteCustomer(organizationId: string, customerId: string): Promise<void> {
  const result = await CustomerModel.deleteOne({ _id: customerId, organizationId });
  if (result.deletedCount === 0) {
    throw AppError.notFound('Customer not found');
  }
  logger.info({ operation: 'customers.delete', organizationId, customerId }, 'Customer deleted');
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: number }).code === MONGO_DUPLICATE_KEY
  );
}
