import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  createCustomer,
  deleteCustomer,
  getCustomer,
  listCustomers,
  updateCustomer,
} from './customers.service.js';
import {
  listCustomersQuerySchema,
  type CreateCustomerInput,
  type UpdateCustomerInput,
} from './customers.validation.js';

export const create = asyncHandler(async (req: Request, res: Response) => {
  const customer = await createCustomer(req.user!.organizationId!, req.body as CreateCustomerInput);
  res.status(201).json({ success: true, data: { customer } });
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const query = listCustomersQuerySchema.parse(req.query);
  const { customers, total, page, limit } = await listCustomers(req.user!.organizationId!, query);
  res.status(200).json({
    success: true,
    data: {
      customers,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    },
  });
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const customer = await getCustomer(req.user!.organizationId!, req.params.id);
  res.status(200).json({ success: true, data: { customer } });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const customer = await updateCustomer(
    req.user!.organizationId!,
    req.params.id,
    req.body as UpdateCustomerInput,
  );
  res.status(200).json({ success: true, data: { customer } });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await deleteCustomer(req.user!.organizationId!, req.params.id);
  res.status(204).send();
});
