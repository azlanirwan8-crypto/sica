'use client';

import React from 'react';

export type StatCardVariant = 'primary' | 'success' | 'warning' | 'info' | 'danger';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string | React.ReactNode;
  variant?: StatCardVariant;
  trend?: {
    value: string;
    isPositive: boolean;
  };
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  variant = 'primary',
  trend,
}: StatCardProps) {
  const variantColorMap: Record<StatCardVariant, { bg: string; text: string; iconBg: string }> = {
    primary: {
      bg: 'var(--sica-color-primary-light)',
      text: 'var(--sica-color-primary)',
      iconBg: 'rgba(10, 179, 156, 0.15)',
    },
    success: {
      bg: 'var(--sica-color-success-light)',
      text: 'var(--sica-color-success)',
      iconBg: 'rgba(10, 179, 156, 0.15)',
    },
    warning: {
      bg: 'var(--sica-color-warning-light)',
      text: 'var(--sica-color-warning)',
      iconBg: 'rgba(247, 184, 75, 0.2)',
    },
    info: {
      bg: 'var(--sica-color-info-light)',
      text: 'var(--sica-color-info)',
      iconBg: 'rgba(41, 156, 219, 0.15)',
    },
    danger: {
      bg: 'var(--sica-color-danger-light)',
      text: 'var(--sica-color-danger)',
      iconBg: 'rgba(240, 101, 72, 0.15)',
    },
  };

  const currentVariant = variantColorMap[variant];

  return (
    <div
      style={{
        backgroundColor: 'var(--sica-surface-card)',
        borderRadius: 'var(--sica-radius-lg)',
        padding: '20px 24px',
        boxShadow: 'var(--sica-shadow-card)',
        border: '1px solid var(--sica-border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--sica-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          {title}
        </span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <span
            style={{
              fontSize: '26px',
              fontWeight: 700,
              color: 'var(--sica-text-heading)',
              lineHeight: 1.2,
            }}
          >
            {value}
          </span>
          {trend && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: trend.isPositive ? 'var(--sica-color-success)' : 'var(--sica-color-danger)',
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
              }}
            >
              {trend.isPositive ? '↑' : '↓'} {trend.value}
            </span>
          )}
        </div>
        {subtitle && (
          <span
            style={{
              fontSize: '12px',
              color: 'var(--sica-text-muted)',
            }}
          >
            {subtitle}
          </span>
        )}
      </div>

      {icon && (
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: 'var(--sica-radius-md)',
            backgroundColor: currentVariant.iconBg,
            color: currentVariant.text,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px',
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      )}
    </div>
  );
}
