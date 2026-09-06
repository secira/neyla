import type { BuildPlan } from '~/lib/build-plan';

interface BuildPlanDialogProps {
  plan: BuildPlan;
  onChange: (plan: BuildPlan) => void;
  onApprove: () => void;
  onCancel: () => void;
}

function editList(
  plan: BuildPlan,
  key: 'features' | 'dataNeeds' | 'integrations' | 'steps' | 'assumptions' | 'decisions',
  value: string,
  onChange: (plan: BuildPlan) => void,
) {
  const items = value
    .split('\n')
    .map((item) => item.replace(/^[-*\d.)\s]+/, '').trim())
    .filter(Boolean);

  if (key === 'features' || key === 'dataNeeds' || key === 'integrations') {
    onChange({
      ...plan,
      specification: {
        ...plan.specification,
        [key]: items,
      },
    });
    return;
  }

  onChange({ ...plan, [key]: items });
}

function getList(
  plan: BuildPlan,
  key: 'features' | 'dataNeeds' | 'integrations' | 'steps' | 'assumptions' | 'decisions',
) {
  if (key === 'features' || key === 'dataNeeds' || key === 'integrations') {
    return plan.specification[key];
  }

  return plan[key];
}

export function BuildPlanDialog({ plan, onChange, onApprove, onCancel }: BuildPlanDialogProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="build-plan-title"
        className="flex max-h-[min(90vh,760px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 shadow-2xl"
      >
        <div className="border-b border-bolt-elements-borderColor px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-bolt-elements-textSecondary">
            Neyla planning step
          </p>
          <h2 id="build-plan-title" className="mt-1 text-xl font-semibold text-bolt-elements-textPrimary">
            Review your build plan
          </h2>
          <p className="mt-1 text-sm text-bolt-elements-textSecondary">
            Make changes before Neyla writes code. Small follow-up edits will continue directly in chat.
          </p>
        </div>

        <div className="modern-scrollbar space-y-5 overflow-y-auto px-6 py-5">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-bolt-elements-textPrimary">Project name</span>
            <input
              value={plan.specification.projectName}
              onChange={(event) =>
                onChange({
                  ...plan,
                  specification: { ...plan.specification, projectName: event.target.value },
                })
              }
              className="w-full rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-3 py-2 text-sm text-bolt-elements-textPrimary outline-none focus:border-bolt-elements-focus"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-bolt-elements-textPrimary">What we are building</span>
            <textarea
              value={plan.summary}
              onChange={(event) => onChange({ ...plan, summary: event.target.value })}
              rows={2}
              className="w-full resize-y rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-3 py-2 text-sm text-bolt-elements-textPrimary outline-none focus:border-bolt-elements-focus"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-bolt-elements-textPrimary">Audience</span>
              <input
                value={plan.specification.audience}
                onChange={(event) =>
                  onChange({
                    ...plan,
                    specification: { ...plan.specification, audience: event.target.value },
                  })
                }
                className="w-full rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-3 py-2 text-sm text-bolt-elements-textPrimary outline-none focus:border-bolt-elements-focus"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-bolt-elements-textPrimary">Platform</span>
              <input
                value={plan.specification.platform}
                onChange={(event) =>
                  onChange({
                    ...plan,
                    specification: { ...plan.specification, platform: event.target.value },
                  })
                }
                className="w-full rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-3 py-2 text-sm text-bolt-elements-textPrimary outline-none focus:border-bolt-elements-focus"
              />
            </label>
          </div>

          {(
            [
              ['features', 'Core features'],
              ['steps', 'Build steps'],
              ['dataNeeds', 'Data needs'],
              ['integrations', 'Integrations'],
              ['assumptions', 'Assumptions'],
              ['decisions', 'Decisions and notes'],
            ] as const
          ).map(([key, label]) => (
            <label className="block" key={key}>
              <span className="mb-1 block text-sm font-medium text-bolt-elements-textPrimary">{label}</span>
              <textarea
                value={getList(plan, key).join('\n')}
                onChange={(event) => editList(plan, key, event.target.value, onChange)}
                rows={Math.min(5, Math.max(2, getList(plan, key).length))}
                className="w-full resize-y rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-3 py-2 text-sm text-bolt-elements-textPrimary outline-none focus:border-bolt-elements-focus"
                aria-label={`${label}, one item per line`}
              />
            </label>
          ))}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-bolt-elements-borderColor px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm text-bolt-elements-textSecondary transition hover:bg-bolt-elements-background-depth-2 hover:text-bolt-elements-textPrimary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onApprove}
            className="rounded-lg bg-bolt-elements-button-primary-background px-4 py-2 text-sm font-medium text-bolt-elements-button-primary-text transition hover:opacity-90"
          >
            Approve plan and start building
          </button>
        </div>
      </div>
    </div>
  );
}
