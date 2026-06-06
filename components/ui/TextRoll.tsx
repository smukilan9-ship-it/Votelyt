"use client";
import { motion } from "framer-motion";
import React from "react";

const STAGGER = 0.03;
const NBSP = " ";

/**
 * TextRoll — letters roll up on hover to reveal a duplicate beneath.
 * Adapted from Skiper UI's Skiper58. Pass a plain string child.
 */
export const TextRoll: React.FC<{
  children: string;
  className?: string;
  center?: boolean;
}> = ({ children, className = "", center = false }) => {
  const chars = children.split("");
  const delayFor = (i: number) =>
    center ? STAGGER * Math.abs(i - (chars.length - 1) / 2) : STAGGER * i;

  return (
    <motion.span
      initial="initial"
      whileHover="hovered"
      className={`relative inline-block overflow-hidden align-bottom ${className}`}
      style={{ lineHeight: 0.95 }}
    >
      <span className="block">
        {chars.map((l, i) => (
          <motion.span
            key={i}
            variants={{ initial: { y: 0 }, hovered: { y: "-100%" } }}
            transition={{ ease: "easeInOut", delay: delayFor(i) }}
            className="inline-block"
          >
            {l === " " ? NBSP : l}
          </motion.span>
        ))}
      </span>
      <span className="absolute inset-0">
        {chars.map((l, i) => (
          <motion.span
            key={i}
            variants={{ initial: { y: "100%" }, hovered: { y: 0 } }}
            transition={{ ease: "easeInOut", delay: delayFor(i) }}
            className="inline-block"
          >
            {l === " " ? NBSP : l}
          </motion.span>
        ))}
      </span>
    </motion.span>
  );
};
