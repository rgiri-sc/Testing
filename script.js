import { useEffect, useRef, useState } from 'react';

import { useAtom } from 'jotai';
import { signIn, useSession } from 'next-auth/react';
import router from 'next/router';
import { useMediaQuery } from 'react-responsive';
import config from 'temp/config';

import RegionClose from '@/core/atoms/Icons/RegionClose';
import LinkAtom from '@/core/atoms/LinkAtom/LinkAtom';
import { useGTMDataLayer } from '@/hooks/useGTMDataLayer';
import { isSecondaryMenuOpenAtom } from '@/state/store';
import { cn } from '@/utils/styles';
import {
  type ComponentParams,
  type ComponentRendering,
  type LinkField,
} from '@sitecore-jss/sitecore-jss-nextjs';

type DropDownCTA = {
  cta: {
    jsonValue: LinkField;
  };
};
interface AccountCTAProps {
  fields: {
    data: {
      datasource: {
        accountPageUrl: {
          jsonValue: LinkField;
        };
        loginPageUrl: {
          jsonValue: LinkField;
        };
        children: {
          results: DropDownCTA[];
        };
      };
    };
  };
  rendering: ComponentRendering & { params: ComponentParams };
  params: ComponentParams;
  isHeader?: boolean;
  sharedHeader?: boolean;
}

type AccountDropdownProps = {
  userName: string;
  cta: DropDownCTA[];
};

const CtaLink = (props: { link: LinkField; text: string }) => {
  const { pushToDataLayer } = useGTMDataLayer();
  if (!props?.link?.value?.href) {
    return (
      <div className="my-4 flex cursor-not-allowed items-center gap-1 px-5 text-sm font-medium text-fontNeutralThree opacity-50 lg:px-2 print:hidden">
        {props?.text}
      </div>
    );
  }

  const handleCTAClick = (link: LinkField | undefined) => {
    pushToDataLayer({
      eventName: 'top_menu_item_click',
      position: 'Top Header',
      clickUrl: link?.value?.href,
      clickText: link?.value?.text,
    });
    // navigate to click url using next router
    router.push(link?.value?.href as string);
  };
  return (
    <LinkAtom
      onClick={(e) => {
        e.preventDefault();
        handleCTAClick(props?.link);
      }}
      className="my-4 flex items-center gap-1 px-5 text-sm font-medium text-fontNeutralThree lg:px-2 print:hidden"
      field={props?.link}
    >
      {props?.text}
    </LinkAtom>
  );
};

const AccountDropdown = ({ userName, cta }: AccountDropdownProps) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null),
    isMobile = useMediaQuery({ maxWidth: 768 }),
    desktopDropDownRef = useRef<HTMLDivElement>(null);

  const closeDropdown = () => {
    setTimeout(() => setOpen(false), 100);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    }
    const currentDropdownRef = dropdownRef.current;
    if (!isMobile && currentDropdownRef) {
      currentDropdownRef.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      if (currentDropdownRef) {
        currentDropdownRef.removeEventListener('mousedown', handleClickOutside);
      }
    };
  }, []);

  const handleDropdownItemClick = (e: React.MouseEvent<HTMLElement>) => {
    const eventTarget = e.target as HTMLElement;
    // Check if the click was on an anchor tag inside the dropdown
    const anchor = eventTarget.closest('a');
    if (anchor && anchor.href) {
      if (anchor.target === '_blank') {
        window.open(anchor.href, '_blank');
      } else {
        window.location.href = anchor.href;
      }
    }
    closeDropdown();
  };

  return (
    <div ref={dropdownRef} className="relative">
      <div
        className="group flex items-center gap-1 px-5 py-4 text-sm font-medium text-fontNeutralThree lg:px-2 print:hidden"
        onClick={() => setOpen(true)}
        role="button"
      >
        {userName}

        {/* Desktop Popup */}
        {!isMobile && (
          <div
            ref={desktopDropDownRef}
            className={cn(
              'group-hover:block absolute mt-4 top-6 z-[60] hidden w-max min-w-full border-t-2 border-brandOne bg-bgWhite pb-0.5 shadow-mlg'
            )}
          >
            {cta?.map((item, index) => (
              <LinkAtom
                key={index}
                field={item?.cta?.jsonValue}
                className="my-3 block w-full px-3 text-left text-sm font-normal"
                onClick={handleDropdownItemClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* Mobile Popup */}
      {isMobile && (
        <div
          className={cn(
            'fixed inset-0 z-50 flex items-start justify-center bg-black/50 lg:hidden',
            open ? 'flex' : 'hidden'
          )}
        >
          <div className="mt-24 max-h-[80vh] w-4/5 overflow-hidden bg-bgWhite">
            <div className="flex items-center justify-between bg-bgGray p-4">
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium text-fontNeutralThree">{userName}</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-fontGray">
                <span className="sr-only">Close</span>
                <RegionClose />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto pb-[22.5px] pt-[2.5px]">
              {cta?.map((item, index) => (
                <LinkAtom
                  key={index}
                  field={item?.cta?.jsonValue}
                  className="block w-full px-4 py-[7.5px] text-left text-sm font-medium"
                  onClick={handleDropdownItemClick}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AccountCTA = (props: Readonly<AccountCTAProps>) => {
  const fields = props?.fields?.data?.datasource,
    { isHeader = false, sharedHeader = false } = props,
    publicURL = config.publicUrl?.toLowerCase(),
    [isLoggedIn, setIsLoggedIn] = useState(false),
    sessionData = useSession(),
    session = sessionData?.data,
    [isSecondaryMenuOpen] = useAtom(isSecondaryMenuOpenAtom);

  useEffect(() => {
    if (sessionData?.status === 'loading') return;

    if (sharedHeader && sessionData?.status === 'unauthenticated') {
      // Try silent login first
      signIn('azure-ad-b2c', {
        callbackUrl: window.location.href, // Redirect back after login
        prompt: 'none',
      });
    }
  }, [sessionData?.status, sharedHeader]);

  /* Hook to check if the user is logged in */
  useEffect(() => {
    // TODO: Check if the user is logged in
    const sessionExpiry = session?.expires && new Date(session?.expires);
    if (!sessionExpiry) {
      setIsLoggedIn(false);
      return;
    }
    const currentDate = new Date();
    if (currentDate < sessionExpiry) {
      setIsLoggedIn(true);
    } else {
      setIsLoggedIn(false);
    }
  }, [session]);

  const getUserName = () => {
    if (!session?.user?.name || session?.user?.name === '') return 'Account';
    const name = session?.user?.name;
    return name?.includes(',')
      ? name?.split(',')?.[1]?.trim()
      : (name?.split(' ')?.[0]?.trim() ?? name);
  };

  return (
    <div
      className={cn(
        'flex flex-col lg:flex-row',
        props.params?.GridParameters,
        props.params?.Styles,
        isHeader && isSecondaryMenuOpen && 'max-lg:hidden'
      )}
      id={props?.params?.RenderingIdentifier || undefined}
    >
      {/* User is logged in */}
      {isLoggedIn ? (
        <>
          {sharedHeader ? (
            <div>
              <AccountDropdown userName={getUserName()} cta={fields?.children?.results} />
            </div>
          ) : (
            <CtaLink link={fields?.accountPageUrl?.jsonValue} text={getUserName()} />
          )}

          <a
            href={`${publicURL}/api/auth/signout`}
            className="my-4 flex items-center gap-1 px-5 text-sm font-medium text-fontNeutralThree lg:px-2 print:hidden"
          >
            Logout
          </a>
        </>
      ) : (
        <CtaLink
          link={fields?.loginPageUrl?.jsonValue || { value: { text: 'Login' } }}
          text={fields?.loginPageUrl?.jsonValue?.value?.text || 'Login'}
        />
      )}
    </div>
  );
};

export default AccountCTA;
