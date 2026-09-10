import { Schema, model, Types, type HydratedDocument } from 'mongoose';

export const AUTOMATION_TRIGGERS = ['TICKET_CREATED'] as const;
export type AutomationTrigger = (typeof AUTOMATION_TRIGGERS)[number];

export const CONDITION_FIELDS = ['priority', 'category', 'subject'] as const;
export type ConditionField = (typeof CONDITION_FIELDS)[number];

export const CONDITION_OPERATORS = ['eq', 'contains', 'in'] as const;
export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

export const ACTION_TYPES = ['SET_PRIORITY', 'SET_CATEGORY', 'ASSIGN_TEAM', 'ASSIGN_AGENT'] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export interface RuleCondition {
  field: ConditionField;
  operator: ConditionOperator;
  value: string[];
}

export interface RuleAction {
  type: ActionType;
  value: string;
}

export interface AutomationRule {
  organizationId: Types.ObjectId;
  name: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  conditions: RuleCondition[];
  actions: RuleAction[];
  createdAt: Date;
  updatedAt: Date;
}

const conditionSchema = new Schema<RuleCondition>(
  {
    field: { type: String, enum: CONDITION_FIELDS, required: true },
    operator: { type: String, enum: CONDITION_OPERATORS, required: true },
    value: { type: [String], required: true },
  },
  { _id: false },
);

const actionSchema = new Schema<RuleAction>(
  {
    type: { type: String, enum: ACTION_TYPES, required: true },
    value: { type: String, required: true },
  },
  { _id: false },
);

const automationRuleSchema = new Schema<AutomationRule>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    enabled: { type: Boolean, default: true },
    trigger: { type: String, enum: AUTOMATION_TRIGGERS, required: true, default: 'TICKET_CREATED' },
    conditions: { type: [conditionSchema], default: [] },
    actions: { type: [actionSchema], required: true },
  },
  {
    timestamps: true,
    toJSON: {
      versionKey: false,
      transform(_doc, ret) {
        const r = ret as Record<string, unknown>;
        r.id = String(r._id);
        delete r._id;
        r.organizationId = String(r.organizationId);
        return r;
      },
    },
  },
);

export type AutomationRuleDocument = HydratedDocument<AutomationRule>;

export const AutomationRuleModel = model<AutomationRule>('AutomationRule', automationRuleSchema);
